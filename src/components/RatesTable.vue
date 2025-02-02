<template>
  <div>
    <h1>Расчёт неустойки с учётом изменяющейся ставки</h1>
    
    <div class="input-section">
      <label>Сумма долга:</label>
      <input 
        type="number" 
        v-model.number="initialDebt" 
        @change="recalculate"
        min="0"
      /> руб.
    </div>

    <div class="input-section">
      <label>Начальная дата:</label>
      <input 
        type="date" 
        v-model="startDate"
        @change="recalculate"
      />
    </div>

    <div v-if="loading" class="status-message">Загрузка ставок...</div>
    <div v-else-if="error" class="error-message">Ошибка загрузки данных</div>
    
    <template v-else>
      <div class="result">
        <h2>Итого неустойка: {{ totalPenalty.toFixed(2) }} руб.</h2>
        <p>Текущий долг: {{ currentDebt.toFixed(2) }} руб.</p>
      </div>

      <h3>Детализация начислений:</h3>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Период</th>
              <th>Ставка</th>
              <th>Дней</th>
              <th>Начислено</th>
              <th>Долг на начало периода</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(period, idx) in breakdown" :key="idx">
              <td>{{ formatDate(period.start) }} - {{ formatDate(period.end) }}</td>
              <td>{{ period.rate.toFixed(2) }}%</td>
              <td>{{ period.days }}</td>
              <td>{{ period.penalty.toFixed(2) }} руб.</td>
              <td>{{ period.debtAtStart.toFixed(2) }} руб.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script>
export default {
  name: 'PenaltyCalculator',
  data() {
    return {
      initialDebt: 2_000_000,
      startDate: '2024-01-01',
      rates: [],
      loading: true,
      error: false,
      currentDebt: 0,
      totalPenalty: 0,
      breakdown: []
    }
  },
  async mounted() {
    await this.loadRates()
  },
  methods: {
    async loadRates() {
      try {
        this.loading = true
        const response = await fetch('/api/rates')
        const data = await response.json()
        
        if (!Array.isArray(data?.rates)) {
          throw new Error('Некорректный формат данных')
        }
        
        this.rates = data.rates
          .map(r => ({
            date: r.date.split('T')[0],
            value: parseFloat(r.value)
          }))
          .sort((a, b) => new Date(a.date) - new Date(b.date))
        
        this.recalculate()
      } catch (err) {
        console.error('Ошибка:', err)
        this.error = true
      } finally {
        this.loading = false
      }
    },

    recalculate() {
      if (!this.rates.length) return

      const periods = this.preparePeriods()
      let debt = parseFloat(this.initialDebt)
      let total = 0
      const breakdown = []

      for (const period of periods) {
        const days = this.calculateDays(period.start, period.end)
        if (days <= 0) continue

        const penalty = debt * (period.rate / 100) * (days / 365)
        total += penalty
        debt += penalty

        breakdown.push({
          start: period.start,
          end: period.end,
          rate: period.rate,
          days,
          penalty,
          debtAtStart: debt - penalty // Сохраняем начальный долг до начисления
        })
      }

      this.totalPenalty = total
      this.currentDebt = debt
      this.breakdown = breakdown
    },

    preparePeriods() {
      const today = new Date().toISOString().split('T')[0]
      const periods = []
      let prevDate = this.startDate

      // Добавляем текущую дату как конечную точку
      const adjustedRates = [...this.rates]
      const lastRateDate = new Date(adjustedRates[adjustedRates.length - 1].date)
      if (new Date(today) > lastRateDate) {
        adjustedRates.push({
          date: today,
          value: adjustedRates[adjustedRates.length - 1].value
        })
      }

      for (const rate of adjustedRates) {
        const currentDate = rate.date
        if (new Date(currentDate) < new Date(prevDate)) continue

        periods.push({
          start: prevDate,
          end: currentDate,
          rate: rate.value
        })
        prevDate = currentDate
      }

      return periods
    },

    calculateDays(start, end) {
      const startDate = new Date(start)
      const endDate = new Date(end)
      const diff = endDate.getTime() - startDate.getTime()
      return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)))
    },

    formatDate(isoString) {
      return new Date(isoString).toLocaleDateString('ru-RU')
    }
  }
}
</script>

<style scoped>
.input-section {
  margin: 20px 0;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

label {
  margin-right: 10px;
  font-weight: bold;
}

input[type="number"], input[type="date"] {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-right: 10px;
}

.result {
  background: #e8f4ff;
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
}

.table-wrapper {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 15px;
}

th, td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

th {
  background-color: #f8f9fa;
}

tr:hover {
  background-color: #f5f5f5;
}

.status-message, .error-message {
  padding: 15px;
  border-radius: 4px;
  margin: 20px 0;
}

.status-message {
  background: #fff3cd;
  color: #856404;
}

.error-message {
  background: #f8d7da;
  color: #721c24;
}
</style>