<template>
  <div>
    <h1>История ключевой ставки ЦБ РФ (Vue)</h1>
    <table border="1" cellspacing="0" cellpadding="5">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Ставка (%)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="2">Загрузка данных...</td>
        </tr>
        <tr v-for="(rate, index) in rates" :key="index">
          <td>{{ rate.date }}</td>
          <td>{{ rate.value.toFixed(2) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
export default {
  name: "RatesTable",
  data() {
    return {
      rates: [],
      loading: true
    }
  },
  async mounted() {
    try {
      const response = await fetch('/api/rates');
      const data = await response.json();
      this.rates = data.rates;
    } catch (error) {
      console.error("Ошибка загрузки данных:", error);
    } finally {
      this.loading = false;
    }
  }
}
</script>

<style scoped>
/* Можно добавить стили по необходимости */
</style>
