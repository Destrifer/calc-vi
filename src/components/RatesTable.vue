<template>
  <div class="calculator">
    <h1>Калькулятор погашения задолженности</h1>

    <!-- Блок ввода параметров -->
    <div class="input-group">
      <div class="input-item">
        <label>Сумма долга:</label>
        <input type="number" v-model.number="initialDebt" @input="recalculate" min="0">
      </div>

      <div class="input-item">
        <label>Дата начала:</label>
        <input type="date" v-model="startDate" @change="recalculate">
      </div>

      <div class="input-item">
        <label>Ежемесячный платёж:</label>
        <input type="number" v-model.number="monthlyPayment" @input="recalculate" min="0">
      </div>
    </div>

    <!-- Блок статуса -->
    <div v-if="loading" class="status loading">Загрузка данных о ставках...</div>
    <div v-else-if="error" class="status error">Ошибка загрузки данных</div>

    <!-- Результаты -->
    <div v-else class="results">
      <div class="summary">
        <div class="summary-item">
          <span class="label">Текущая неустойка:</span>
          <span class="value">{{ totalPenalty.toFixed(2) }} ₽</span>
        </div>
        <div class="summary-item">
          <span class="label">Общий долг:</span>
          <span class="value">{{ currentDebt.toFixed(2) }} ₽</span>
        </div>
        <div class="summary-item highlight" v-if="monthsToPayoff !== null">
          <span class="label">Срок погашения:</span>
          <span class="value">
            {{ formatMonths(monthsToPayoff) }}
            <span v-if="isInfinite" class="warning-text">(Долг не уменьшается!)</span>
          </span>
        </div>
      </div>

      <!-- Детализация -->
      <div class="details">
        <h2>Детализация начислений</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Период</th>
                <th>Ставка</th>
                <th>Дней</th>
                <th>Начислено</th>
                <th>Долг на начало</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(period, index) in breakdown" :key="index">
                <td>{{ formatDate(period.start) }} - {{ formatDate(period.end) }}</td>
                <td>{{ period.rate.toFixed(2) }}%</td>
                <td>{{ period.days }}</td>
                <td>{{ period.penalty.toFixed(2) }} ₽</td>
                <td>{{ period.debtAtStart.toFixed(2) }} ₽</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Предупреждения -->
    <div v-if="paymentWarning" class="warning">
      ⚠️ Внимание! Размер платежа меньше ежемесячных начислений. Долг будет увеличиваться.
    </div>
  </div>
</template>

<script>
export default {
  name: 'DebtCalculator',
  data() {
    return {
      initialDebt: 2_143_714,
      startDate: '2024-06-01',
      monthlyPayment: 125_000,
      rates: [],
      currentDebt: 0,
      totalPenalty: 0,
      breakdown: [],
      monthsToPayoff: null,
      paymentWarning: false,
      isInfinite: false,
      loading: true,
      error: false,
      maxCalculationPeriod: 1200 // 100 лет (защита от бесконечного цикла)
    }
  },
  async mounted() {
    await this.loadRates();
  },
  methods: {
    async loadRates() {
      try {
        this.loading = true;
        const response = await fetch('/api/rates');
        const data = await response.json();
        
        if (!Array.isArray(data?.rates)) {
          throw new Error('Неверный формат данных');
        }

        this.rates = data.rates
          .map(rate => ({
            date: new Date(rate.date).toISOString().split('T')[0],
            value: parseFloat(rate.value)
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        this.recalculate();
      } catch (err) {
        console.error('Ошибка загрузки ставок:', err);
        this.error = true;
      } finally {
        this.loading = false;
      }
    },

    recalculate() {
      if (!this.rates.length) return;

      // Рассчитываем текущую задолженность
      this.calculateCurrentDebt();
      
      // Рассчитываем срок погашения
      this.calculatePayoffTime();
    },

    calculateCurrentDebt() {
      let debt = parseFloat(this.initialDebt);
      let totalPenalty = 0;
      const periods = this.buildPeriods();
      const breakdown = [];

      for (const period of periods) {
        const days = this.calculateDays(period.start, period.end);
        if (days <= 0) continue;

        const penalty = debt * (period.rate / 100) * (days / 365);
        totalPenalty += penalty;
        debt += penalty;

        breakdown.push({
          start: period.start,
          end: period.end,
          rate: period.rate,
          days,
          penalty,
          debtAtStart: debt - penalty
        });
      }

      this.totalPenalty = totalPenalty;
      this.currentDebt = debt;
      this.breakdown = breakdown;
    },

    buildPeriods() {
      const today = new Date().toISOString().split('T')[0];
      const periods = [];
      let currentDate = this.startDate;

      // Создаем копию ставок с добавлением текущей даты
      const rates = [...this.rates];
      const lastRateDate = new Date(rates[rates.length - 1]?.date || today);
      
      if (new Date(today) > lastRateDate) {
        rates.push({
          date: today,
          value: rates[rates.length - 1].value
        });
      }

      for (const rate of rates) {
        if (new Date(rate.date) < new Date(currentDate)) continue;
        
        periods.push({
          start: currentDate,
          end: rate.date,
          rate: rate.value
        });
        
        currentDate = rate.date;
      }

      return periods;
    },

    calculatePayoffTime() {
      if (this.monthlyPayment <= 0) {
        this.monthsToPayoff = null;
        return;
      }

      let months = 0;
      let debt = this.currentDebt;
      let currentDate = new Date();
      this.paymentWarning = false;
      this.isInfinite = false;

      while (debt > 0 && months < this.maxCalculationPeriod) {
        // Получаем ставку для текущего месяца
        const rate = this.getRateForDate(currentDate);
        
        // Рассчитываем неустойку за месяц
        const daysInMonth = this.getDaysInMonth(currentDate);
        const monthlyPenalty = debt * (rate / 100) * (daysInMonth / 365);
        
        // Проверяем возможность погашения
        if (this.monthlyPayment <= monthlyPenalty) {
          this.paymentWarning = true;
          this.isInfinite = true;
          break;
        }

        // Обновляем сумму долга
        debt += monthlyPenalty;
        debt -= this.monthlyPayment;
        
        // Переход к следующему месяцу
        currentDate.setMonth(currentDate.getMonth() + 1);
        months++;
      }

      this.monthsToPayoff = months >= this.maxCalculationPeriod ? null : months;
    },

    // Вспомогательные методы
    calculateDays(start, end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      return Math.ceil((endDate - startDate) / (1000 * 3600 * 24));
    },

    getDaysInMonth(date) {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    },

    getRateForDate(date) {
      const targetDate = date.toISOString().split('T')[0];
      const rate = this.rates
        .slice()
        .reverse()
        .find(r => r.date <= targetDate);
      
      return rate ? rate.value : 0;
    },

    formatDate(isoString) {
      return new Date(isoString).toLocaleDateString('ru-RU');
    },

    formatMonths(months) {
      const years = Math.floor(months / 12);
      const remainingMonths = months % 12;
      return [
        years > 0 ? `${years} г.` : '',
        remainingMonths > 0 ? `${remainingMonths} мес.` : ''
      ].filter(Boolean).join(' ') || 'менее месяца';
    }
  }
}
</script>

<style scoped>
.calculator {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.input-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.input-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

input[type="number"], input[type="date"] {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.input-item input {
  font-size: 14px;
  padding: 10px 15px;
  border: 1px solid #ccc;
  border-radius: 6px;
  width: 100%;
  box-sizing: border-box;
}

.input-item label {
  font-weight: 500;
  margin-bottom: 8px;
  color: #2c3e50;
}

.results {
  margin-top: 25px;
}

.summary {
  display: grid;
  gap: 15px;
  margin-bottom: 30px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.summary-item.highlight {
  background: #e3f2fd;
  font-weight: bold;
}

.details h2 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.table-container {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.warning {
  margin-top: 20px;
  padding: 15px;
  background: #fff3e0;
  border-radius: 4px;
  color: #ef6c00;
}

.status {
  padding: 20px;
  border-radius: 4px;
  text-align: center;
  margin: 20px 0;
}

.status.loading {
  background: #e3f2fd;
  color: #1976d2;
}

.status.error {
  background: #ffebee;
  color: #d32f2f;
}

.warning-text {
  color: #d32f2f;
  margin-left: 10px;
}
</style>