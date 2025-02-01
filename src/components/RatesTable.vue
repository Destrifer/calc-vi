<template>
  <div>
    <h1>Общий расчёт задолженности по неустойке (Vue)</h1>
    
    <p>Сумма долга: <strong>{{ sumDebt.toLocaleString() }} руб.</strong></p>
    
    <!-- Поле ввода для ежемесячного платежа -->
    <div>
      <label for="monthlyPayment">Ежемесячный платеж:</label>
      <input
        type="number"
        id="monthlyPayment"
        v-model.number="monthlyPayment"
        @input="calculateMonthsToPayoff"
        placeholder="Введите сумму"
      />
    </div>

    <p v-if="loading">Загрузка данных...</p>
    <p v-else-if="error">Ошибка загрузки данных</p>
    <p v-else>Общая неустойка: <strong>{{ totalPenalty.toFixed(2) }} руб.</strong></p>

    <!-- Вывод оставшихся месяцев -->
    <p v-if="monthlyPayment > 0">
      <strong>Осталось месяцев до погашения:</strong> {{ monthsToPayoff }}
    </p>

    <h2>Детализация расчёта</h2>
    <table border="1" cellspacing="0" cellpadding="5">
      <thead>
        <tr>
          <th>Период</th>
          <th>Ставка (%)</th>
          <th>Дней</th>
          <th>Начислено (руб.)</th>
          <th>Сумма долга (на начало периода)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="5">Загрузка...</td>
        </tr>
        <tr v-if="error">
          <td colspan="5">Ошибка загрузки данных</td>
        </tr>
        <tr v-for="(row, index) in breakdown" :key="index">
          <td>{{ row.start }} – {{ row.end }}</td>
          <td>{{ row.rate.toFixed(2) }}</td>
          <td>{{ row.days }}</td>
          <td>{{ row.penalty.toFixed(2) }}</td>
          <td>{{ row.debtAtStart.toFixed(2) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: "PenaltyCalculator",
  data() {
    return {
      sumDebt: 2_000_000, // Исходная сумма долга
      monthlyPayment: 0, // Платеж, введенный пользователем
      monthsToPayoff: 0, // Количество месяцев до полного погашения
      rates: [],
      breakdown: [],
      totalPenalty: 0,
      loading: true,
      error: false
    }
  },
  async mounted() {
    await this.fetchRates(); // Загружаем данные при загрузке страницы
  },
  methods: {
    async fetchRates() {
      try {
        console.log("🔄 Обновление данных...");
        this.loading = true;
        
        const response = await fetch('/api/rates');
        const data = await response.json();

        console.log("✅ Данные из API:", data);

        if (!data.rates || !Array.isArray(data.rates)) {
          throw new Error("❌ API вернул некорректный формат!");
        }

        this.rates = data.rates;
        this.calculatePenalty(); // Вызываем расчет
      } catch (error) {
        console.error("❌ Ошибка загрузки данных:", error);
        this.error = true;
      } finally {
        this.loading = false;
      }
    },
    calculatePenalty() {
      let total = 0;
      let breakdown = [];
      let currentDebt = this.sumDebt; // Начальная сумма долга

      const filteredRates = this.rates
        .filter((rate, index, array) => index === 0 || rate.value !== array[index - 1].value)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const today = new Date().toISOString().split("T")[0];
      filteredRates.push({ date: today, value: filteredRates[filteredRates.length - 1].value });

      for (let i = 0; i < filteredRates.length - 1; i++) {
        const currentRate = filteredRates[i].value;
        const startPeriod = new Date(filteredRates[i].date);
        const endPeriod = new Date(filteredRates[i + 1].date);
        const days = (endPeriod - startPeriod) / (1000 * 60 * 60 * 24);

        if (days > 0) {
          const penalty = (currentDebt * currentRate / 100) * (days / 365);
          total += penalty;

          breakdown.push({
            start: filteredRates[i].date,
            end: filteredRates[i + 1].date,
            rate: currentRate,
            days: Math.round(days),
            penalty: penalty,
            debtAtStart: currentDebt
          });

          currentDebt += penalty; // 📌 Добавляем начисленную неустойку к долгу!
        }
      }

      this.totalPenalty = total;
      this.breakdown = breakdown;
      this.calculateMonthsToPayoff(); // Пересчитываем срок погашения
    },
    calculateMonthsToPayoff() {
      if (this.monthlyPayment <= 0) {
        this.monthsToPayoff = 0;
        return;
      }

      let remainingDebt = this.sumDebt + this.totalPenalty;
      let months = 0;

      while (remainingDebt > 0) {
        remainingDebt -= this.monthlyPayment;
        months++;
      }

      this.monthsToPayoff = months;
    }
  }
}
</script>

<style scoped>
input {
  margin-left: 10px;
  padding: 5px;
  width: 150px;
}
</style>
