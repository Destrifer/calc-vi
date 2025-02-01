import { parseStringPromise } from "xml2js";

export async function GET() {
	const today = new Date();
	const fromDate = "2024-06-30"; // Дата начала выборки
	const toDate = today.toISOString().split("T")[0]; // Сегодняшняя дата

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

	// Преобразуем данные в массив { date, value }
	const rateHistory = keyRates.map((rate) => ({
		date: rate["DT"][0].split("T")[0], // Убираем время, оставляем только дату
		value: parseFloat(rate["Rate"][0]) // Числовое значение ставки
	}));

	return new Response(JSON.stringify({ rates: rateHistory }), {
		headers: { "Content-Type": "application/json" }
	});
}
