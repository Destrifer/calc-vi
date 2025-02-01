<template>
  <div>
    <h1>Общий расчёт задолженности по неустойке (Vue)</h1>
    
    <p>Сумма долга: <strong>{{ sumDebt.toLocaleString() }} руб.</strong></p>
    <p v-if="loading">Загрузка данных...</p>
    <p v-else-if="error">Ошибка загрузки данных</p>
    <p v-else>Общая неустойка: <strong>{{ totalPenalty.toFixed(2) }} руб.</strong></p>

    <h2>Детализация расчёта</h2>
    <table border="1" cellspacing="0" cellpadding="5">
      <thead>
        <tr>
          <th>Период</th>
          <th>Ставка (%)</th>
          <th>Дней</th>
          <th>Начислено (руб.)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="4">Загрузка...</td>
        </tr>
        <tr v-if="error">
          <td colspan="4">Ошибка загрузки данных</td>
        </tr>
        <tr v-for="(row, index) in breakdown" :key="index">
          <td>{{ row.start }} – {{ row.end }}</td>
          <td>{{ row.rate.toFixed(2) }}</td>
          <td>{{ row.days }}</td>
          <td>{{ row.penalty.toFixed(2) }}</td>
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
      sumDebt: 2_000_000, // Сумма долга
      rates: [],
      breakdown: [],
      totalPenalty: 0,
      loading: true,
      error: false
    }
  },
  async mounted() {
    try {
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
  methods: {
    calculatePenalty() {
      let total = 0;
      let breakdown = [];

      const filteredRates = this.rates
        .filter((rate, index, array) => index === 0 || rate.value !== array[index - 1].value)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Добавляем сегодняшнюю дату
      const today = new Date().toISOString().split("T")[0];
      filteredRates.push({ date: today, value: filteredRates[filteredRates.length - 1].value });

      for (let i = 0; i < filteredRates.length - 1; i++) {
        const currentRate = filteredRates[i].value;
        const startPeriod = new Date(filteredRates[i].date);
        const endPeriod = new Date(filteredRates[i + 1].date);
        const days = (endPeriod - startPeriod) / (1000 * 60 * 60 * 24);

        if (days > 0) {
          const penalty = (this.sumDebt * currentRate / 100) * (days / 365);
          total += penalty;
          breakdown.push({
            start: filteredRates[i].date,
            end: filteredRates[i + 1].date,
            rate: currentRate,
            days: Math.round(days),
            penalty: penalty
          });
        }
      }

      this.totalPenalty = total;
      this.breakdown = breakdown;
    }
  }
}
</script>

<style scoped>
/* Добавь стили по необходимости */
</style>
