const axios = require("axios");
const {
  extractSoapReturn,
  extractSoapFault,
  decodeXmlB64,
  extractReferenceCEVFromXml,
  extractReferenceTTNFromXml,
} = require("../utils/helpers");

const TTN_URL = "http://51.178.39.67:8081/wsEfactTTN/wsEfactTTN?wsdl";

/**
 * Submits an invoice (EFact) to TTN service
 */
const saveEfactTTN = async (xmlB64, configB64) => {
  const soapRequest = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webService.efactttn.tradenet.com.tn/">
      <soapenv:Header/>
      <soapenv:Body>
        <web:saveEfactTTN>
          <xmlDocEfact>${xmlB64}</xmlDocEfact>
          <configuration>${configB64 || ""}</configuration>
        </web:saveEfactTTN>
      </soapenv:Body>
    </soapenv:Envelope>
  `;

  try {
    const response = await axios.post(TTN_URL, soapRequest, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "",
      },
      timeout: 30000,
    });

    const ret = extractSoapReturn(response.data);
    const fault = extractSoapFault(response.data);

    if (fault) return { success: false, error: fault };
    if (!ret) return { success: false, error: "Réponse TTN vide" };

    const xmlResult = decodeXmlB64(ret);
    const cev = extractReferenceCEVFromXml(xmlResult);
    const ref = extractReferenceTTNFromXml(xmlResult);

    if (cev && ref) {
      return { success: true, referenceTTN: ref, qrPngB64: cev, xmlSigned: ret };
    }

    return {
      success: false,
      error: "Données manquantes dans la réponse TTN",
      debug: xmlResult,
    };
  } catch (err) {
    console.error("SAVE EFACT TTN ERROR:", err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Consults the status of an invoice on TTN
 */
const consultEfactTTN = async (xmlB64, configB64) => {
  const soapRequest = `
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:web="http://webService.efactttn.tradenet.com.tn/">
      <soapenv:Header/>
      <soapenv:Body>
        <web:ConsultEfactTTN>
          <xmlDocEfact>${xmlB64}</xmlDocEfact>
          <configuration>${configB64 || ""}</configuration>
        </web:ConsultEfactTTN>
      </soapenv:Body>
    </soapenv:Envelope>
  `;

  try {
    const response = await axios.post(TTN_URL, soapRequest, {
      headers: {
        "Content-Type": "text/xml;charset=UTF-8",
        SOAPAction: "",
      },
      timeout: 15000,
    });

    const ret = extractSoapReturn(response.data);
    const fault = extractSoapFault(response.data);

    if (fault) return { success: false, error: fault };
    return { success: true, xmlSigned: ret };
  } catch (err) {
    console.error("CONSULT EFACT TTN ERROR:", err.message);
    return { success: false, error: err.message };
  }
};

module.exports = {
  saveEfactTTN,
  consultEfactTTN,
};
