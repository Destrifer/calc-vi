import { parseStringPromise } from "xml2js";

export async function GET() {  // <--- Должно быть с заглавными буквами
	const today = new Date();
	const fromDate = "2024-06-30";
	const toDate = today.toISOString().split("T")[0];

	const sumDebt = 2_000_000;

	const soapRequest = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://web.cbr.ru/">
       <soapenv:Header/>
       <soapenv:Body>
          <web:KeyRateXML>
             <web:fromDate>${fromDate}</web:fromDate>
             <web:ToDate>${toDate}</web:ToDate>
          </web:KeyRateXML>
       </soapenv:Body>
    </soapenv:Envelope>`;

	const response = await fetch("https://www.cbr.ru/DailyInfoWebServ/DailyInfo.asmx", {
		method: "POST",
		headers: {
			"Content-Type": "text/xml; charset=utf-8",
			"SOAPAction": "http://web.cbr.ru/KeyRateXML"
		},
		body: soapRequest
	});

	const xmlText = await response.text();
	const jsonData = await parseStringPromise(xmlText);

	const keyRates = jsonData["soap:Envelope"]["soap:Body"][0]["KeyRateXMLResponse"][0]["KeyRateXMLResult"][0]["KeyRate"][0]["KR"];

	const rateHistory = keyRates.map((rate) => ({
		date: new Date(rate["DT"][0]),
		value: parseFloat(rate["Rate"][0])
	}));

	const filteredRates = rateHistory
		.filter((rate, index, array) => index === 0 || rate.value !== array[index - 1].value)
		.sort((a, b) => a.date - b.date);

	filteredRates.push({ date: today, value: filteredRates[filteredRates.length - 1].value });

	let totalPenalty = 0;
	for (let i = 0; i < filteredRates.length - 1; i++) {
		const rate = filteredRates[i].value;
		const days = Math.max(0, (filteredRates[i + 1].date - filteredRates[i].date) / (1000 * 60 * 60 * 24));
		const penalty = (sumDebt * rate / 100) * (days / 365);
		totalPenalty += penalty;
	}

	return new Response(JSON.stringify({ penalty: totalPenalty.toFixed(2) }), {
		headers: { "Content-Type": "application/json" }
	});
}
