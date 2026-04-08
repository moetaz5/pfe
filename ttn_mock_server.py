"""
TTN E-Invoice Mock Web Services Server
Tunisia Trade Net (TTN) El Fatoora Mock Implementation

Based on official "Specifications techniques Web Services El Fatoora" v5.0
WSDL: https://elfatoora.tn/ElfatouraServices/EfactService?wsdl

This mock server implements the exact TTN APIs:
- saveEfact: Submit a signed invoice
- consultEfact: Query invoices
- verifyQrCode: Verify QR code/CEV
"""

from flask import Flask, request, Response, jsonify
from flasgger import Swagger
from datetime import datetime
import base64
import hashlib
import uuid
import xml.etree.ElementTree as ET
from xml.dom import minidom
import io
import qrcode
import random
import string
import sqlite3

app = Flask(__name__)

# Swagger configuration
swagger_config = {
    "headers": [],
    "specs": [
        {
            "endpoint": "apispec",
            "route": "/apispec.json",
            "rule_filter": lambda rule: True,
            "model_filter": lambda tag: True,
        }
    ],
    "static_url_path": "/flasgger_static",
    "swagger_ui": True,
    "specs_route": "/api/docs",
}

swagger_template = {
    "swagger": "2.0",
    "info": {
        "title": "TTN El Fatoora Mock API",
        "description": "Mock implementation of Tunisia Trade Net (TTN) e-invoicing web services\n\n"
        "Based on official 'Specifications techniques Web Services El Fatoora' v5.0\n\n"
        "**SOAP Web Services:**\n"
        "- Endpoint: `/ElfatouraServices/EfactService`\n"
        "- WSDL: `/ElfatouraServices/EfactService?wsdl`\n\n"
        "**Operations:**\n"
        "- `saveEfact`: Submit and sign an invoice\n"
        "- `consultEfact`: Query invoices\n"
        "- `verifyQrCode`: Verify QR code (CEV)\n",
        "termsOfService": "https://www.tradenet.com.tn",
        "contact": {
            "name": "TTN Support (Mock)",
            "email": "support@tradenet.com.tn",
            "url": "https://www.tradenet.com.tn",
        },
        "version": "5.0-MOCK",
    },
    "host": "localhost:5000",
    "basePath": "/",
    "schemes": ["http"],
    "tags": [
        {
            "name": "SOAP Operations",
            "description": "TTN El Fatoora SOAP web service operations",
        },
        {
            "name": "Service Info",
            "description": "Service information and health check endpoints",
        },
    ],
}

swagger = Swagger(app, config=swagger_config, template=swagger_template)


# ============================================================================
# SQLite Database Configuration
# ============================================================================

DATABASE_FILE = "ttn_invoices.db"


def init_database():
    """Initialize SQLite database and create tables if they don't exist"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Create invoices table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            id_save_efact INTEGER UNIQUE,
            generated_ref TEXT UNIQUE,
            document_number TEXT,
            matricule TEXT,
            date_process TEXT,
            xml_content TEXT,
            status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create counter table for id_save_efact
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS counters (
            name TEXT PRIMARY KEY,
            value INTEGER
        )
    """)

    # Initialize id_counter if not exists
    cursor.execute("SELECT value FROM counters WHERE name = ?", ("id_save_efact",))
    if cursor.fetchone() is None:
        cursor.execute(
            "INSERT INTO counters (name, value) VALUES (?, ?)",
            ("id_save_efact", 100000),
        )

    conn.commit()
    conn.close()
    print(f"✅ Database initialized: {DATABASE_FILE}")


def get_next_id():
    """Get next idSaveEfact value and increment counter"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    cursor.execute("SELECT value FROM counters WHERE name = ?", ("id_save_efact",))
    current_id = cursor.fetchone()[0]

    # Increment counter
    cursor.execute(
        "UPDATE counters SET value = value + 1 WHERE name = ?", ("id_save_efact",)
    )
    conn.commit()
    conn.close()

    return current_id


def save_invoice(invoice_data):
    """Save invoice to database"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO invoices 
        (id, id_save_efact, generated_ref, document_number, matricule, date_process, xml_content, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """,
        (
            invoice_data["id"],
            invoice_data["id_save_efact"],
            invoice_data["generated_ref"],
            invoice_data["document_number"],
            invoice_data["matricule"],
            invoice_data["date_process"],
            invoice_data["xml_content"],
            invoice_data["status"],
        ),
    )

    conn.commit()
    conn.close()


def query_invoices(matricule, criteria=None):
    """Query invoices from database"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row  # To get dict-like results
    cursor = conn.cursor()

    query = "SELECT * FROM invoices WHERE matricule = ?"
    params = [matricule]

    if criteria:
        if criteria.get("document_number"):
            query += " AND document_number = ?"
            params.append(criteria["document_number"])
        if criteria.get("id_save_efact"):
            query += " AND id_save_efact = ?"
            params.append(int(criteria["id_save_efact"]))
        if criteria.get("generated_ref"):
            query += " AND generated_ref = ?"
            params.append(criteria["generated_ref"])

    cursor.execute(query, params)
    print(f"DEBUG query_invoices: SQL='{query}', params={params}")
    rows = cursor.fetchall()
    conn.close()

    # Convert to list of dicts
    results = []
    for row in rows:
        results.append(
            {
                "id": row["id"],
                "id_save_efact": row["id_save_efact"],
                "generated_ref": row["generated_ref"],
                "document_number": row["document_number"],
                "matricule": row["matricule"],
                "date_process": row["date_process"],
                "xml_content": row["xml_content"],
                "status": row["status"],
            }
        )

    return results


# Initialize database on startup
init_database()


# Namespaces for XML signatures
NAMESPACES = {
    "ds": "http://www.w3.org/2000/09/xmldsig#",
    "xades": "http://uri.etsi.org/01903/v1.3.2#",
}


def generate_ttn_reference(sender_id):
    """Generate a mock TTN reference number (generatedRef)"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_suffix = "".join(random.choices(string.digits, k=6))
    return f"{sender_id}{timestamp}{random_suffix}"


def generate_qr_code_base64(data):
    """Generate a QR code as base64 encoded PNG"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )

    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    # Convert to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()

    return img_str


def generate_mock_digest():
    """Generate a mock SHA-256 digest value"""
    random_data = f"{datetime.now().isoformat()}-{uuid.uuid4()}"
    digest = hashlib.sha256(random_data.encode()).digest()
    return base64.b64encode(digest).decode()


def generate_mock_signature_value():
    """Generate a mock RSA signature value (512 bytes base64 encoded)"""
    random_bytes = bytes([random.randint(0, 255) for _ in range(256)])
    return base64.b64encode(random_bytes).decode()


def generate_mock_certificate():
    """Generate a mock X509 certificate (base64 encoded)"""
    mock_cert_data = f"MOCK-TTN-CERT-{uuid.uuid4().hex}".encode()
    mock_cert_data = mock_cert_data * 50  # Pad to realistic size
    return base64.b64encode(mock_cert_data).decode()


def add_ttn_signature_to_xml(xml_string):
    """
    Add TTN signature to the invoice XML
    Matches the structure from exemple_signe_elfatoora.xml
    """
    try:
        root = ET.fromstring(xml_string)

        # Extract sender identifier for reference generation
        sender_elem = root.find(".//MessageSenderIdentifier")
        sender_id = sender_elem.text if sender_elem is not None else "0000000000000"

        # Generate TTN reference and validation data
        ttn_reference = generate_ttn_reference(sender_id)
        validation_date = datetime.now().strftime("%d%m%y%H%M")
        qr_code_data = generate_qr_code_base64(f"TTN:{ttn_reference}:{validation_date}")

        # Create RefTtnVal section
        ref_ttn_val = ET.Element("RefTtnVal")

        reference_ttn = ET.SubElement(ref_ttn_val, "ReferenceTTN")
        reference_ttn.set("refID", "I-88")
        reference_ttn.text = ttn_reference

        reference_date = ET.SubElement(ref_ttn_val, "ReferenceDate")
        date_text = ET.SubElement(reference_date, "DateText")
        date_text.set("format", "ddMMyyHHmm")
        date_text.set("functionCode", "I-37")
        date_text.text = validation_date

        reference_cev = ET.SubElement(ref_ttn_val, "ReferenceCEV")
        reference_cev.text = qr_code_data

        # Create TTN Signature
        sig_ttn = ET.Element("{http://www.w3.org/2000/09/xmldsig#}Signature")
        sig_ttn.set("Id", "SigTTN")

        # SignedInfo
        signed_info = ET.SubElement(
            sig_ttn, "{http://www.w3.org/2000/09/xmldsig#}SignedInfo"
        )

        canon_method = ET.SubElement(
            signed_info, "{http://www.w3.org/2000/09/xmldsig#}CanonicalizationMethod"
        )
        canon_method.set("Algorithm", "http://www.w3.org/2001/10/xml-exc-c14n#")

        sig_method = ET.SubElement(
            signed_info, "{http://www.w3.org/2000/09/xmldsig#}SignatureMethod"
        )
        sig_method.set("Algorithm", "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256")

        # Reference 1 - Document reference
        reference1 = ET.SubElement(
            signed_info, "{http://www.w3.org/2000/09/xmldsig#}Reference"
        )
        reference1.set("Id", "r-id-ttn")
        reference1.set("Type", "")
        reference1.set("URI", "")

        transforms1 = ET.SubElement(
            reference1, "{http://www.w3.org/2000/09/xmldsig#}Transforms"
        )

        transform1a = ET.SubElement(
            transforms1, "{http://www.w3.org/2000/09/xmldsig#}Transform"
        )
        transform1a.set("Algorithm", "http://www.w3.org/TR/1999/REC-xpath-19991116")
        xpath1a = ET.SubElement(
            transform1a, "{http://www.w3.org/2000/09/xmldsig#}XPath"
        )
        xpath1a.text = "not(ancestor-or-self::ds:Signature)"

        transform1b = ET.SubElement(
            transforms1, "{http://www.w3.org/2000/09/xmldsig#}Transform"
        )
        transform1b.set("Algorithm", "http://www.w3.org/2001/10/xml-exc-c14n#")

        digest_method1 = ET.SubElement(
            reference1, "{http://www.w3.org/2000/09/xmldsig#}DigestMethod"
        )
        digest_method1.set("Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256")

        digest_value1 = ET.SubElement(
            reference1, "{http://www.w3.org/2000/09/xmldsig#}DigestValue"
        )
        digest_value1.text = generate_mock_digest()

        # Reference 2 - XAdES properties
        reference2 = ET.SubElement(
            signed_info, "{http://www.w3.org/2000/09/xmldsig#}Reference"
        )
        reference2.set("Type", "http://uri.etsi.org/01903#SignedProperties")
        reference2.set("URI", "#xades-SigTTN")

        transforms2 = ET.SubElement(
            reference2, "{http://www.w3.org/2000/09/xmldsig#}Transforms"
        )
        transform2 = ET.SubElement(
            transforms2, "{http://www.w3.org/2000/09/xmldsig#}Transform"
        )
        transform2.set("Algorithm", "http://www.w3.org/2001/10/xml-exc-c14n#")

        digest_method2 = ET.SubElement(
            reference2, "{http://www.w3.org/2000/09/xmldsig#}DigestMethod"
        )
        digest_method2.set("Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256")

        digest_value2 = ET.SubElement(
            reference2, "{http://www.w3.org/2000/09/xmldsig#}DigestValue"
        )
        digest_value2.text = generate_mock_digest()

        # SignatureValue
        sig_value = ET.SubElement(
            sig_ttn, "{http://www.w3.org/2000/09/xmldsig#}SignatureValue"
        )
        sig_value.set("Id", "value-SigTTN")
        sig_value.text = generate_mock_signature_value()

        # KeyInfo with mock X.509 certificate
        key_info = ET.SubElement(sig_ttn, "{http://www.w3.org/2000/09/xmldsig#}KeyInfo")
        x509_data = ET.SubElement(
            key_info, "{http://www.w3.org/2000/09/xmldsig#}X509Data"
        )
        x509_cert = ET.SubElement(
            x509_data, "{http://www.w3.org/2000/09/xmldsig#}X509Certificate"
        )
        x509_cert.text = generate_mock_certificate()

        # XAdES Object
        ds_object = ET.SubElement(sig_ttn, "{http://www.w3.org/2000/09/xmldsig#}Object")
        qualifying_props = ET.SubElement(
            ds_object, "{http://uri.etsi.org/01903/v1.3.2#}QualifyingProperties"
        )
        qualifying_props.set("Target", "#SigTTN")

        signed_props = ET.SubElement(
            qualifying_props, "{http://uri.etsi.org/01903/v1.3.2#}SignedProperties"
        )
        signed_props.set("Id", "xades-SigTTN")

        signed_sig_props = ET.SubElement(
            signed_props, "{http://uri.etsi.org/01903/v1.3.2#}SignedSignatureProperties"
        )

        # Signing time
        signing_time = ET.SubElement(
            signed_sig_props, "{http://uri.etsi.org/01903/v1.3.2#}SigningTime"
        )
        signing_time.text = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

        # Signing certificate
        signing_cert = ET.SubElement(
            signed_sig_props, "{http://uri.etsi.org/01903/v1.3.2#}SigningCertificateV2"
        )
        cert = ET.SubElement(signing_cert, "{http://uri.etsi.org/01903/v1.3.2#}Cert")
        cert_digest = ET.SubElement(
            cert, "{http://uri.etsi.org/01903/v1.3.2#}CertDigest"
        )

        cert_digest_method = ET.SubElement(
            cert_digest, "{http://www.w3.org/2000/09/xmldsig#}DigestMethod"
        )
        cert_digest_method.set("Algorithm", "http://www.w3.org/2000/09/xmldsig#sha1")

        cert_digest_value = ET.SubElement(
            cert_digest, "{http://www.w3.org/2000/09/xmldsig#}DigestValue"
        )
        cert_digest_value.text = base64.b64encode(
            hashlib.sha1(uuid.uuid4().bytes).digest()
        ).decode()

        issuer_serial = ET.SubElement(
            cert, "{http://uri.etsi.org/01903/v1.3.2#}IssuerSerialV2"
        )
        issuer_serial.text = base64.b64encode(b"TTN-MOCK-ISSUER").decode()

        # Signature Policy
        sig_policy_id = ET.SubElement(
            signed_sig_props,
            "{http://uri.etsi.org/01903/v1.3.2#}SignaturePolicyIdentifier",
        )
        sig_policy = ET.SubElement(
            sig_policy_id, "{http://uri.etsi.org/01903/v1.3.2#}SignaturePolicyId"
        )

        policy_id = ET.SubElement(
            sig_policy, "{http://uri.etsi.org/01903/v1.3.2#}SigPolicyId"
        )
        identifier = ET.SubElement(
            policy_id, "{http://uri.etsi.org/01903/v1.3.2#}Identifier"
        )
        identifier.set("Qualifier", "OIDasURN")
        identifier.text = "urn:2.16.788.1.2.1"

        description = ET.SubElement(
            policy_id, "{http://uri.etsi.org/01903/v1.3.2#}Description"
        )
        description.text = "Politique de signature de la facture electronique"

        policy_hash = ET.SubElement(
            sig_policy, "{http://uri.etsi.org/01903/v1.3.2#}SigPolicyHash"
        )
        policy_digest_method = ET.SubElement(
            policy_hash, "{http://www.w3.org/2000/09/xmldsig#}DigestMethod"
        )
        policy_digest_method.set("Algorithm", "http://www.w3.org/2001/04/xmlenc#sha256")

        policy_digest_value = ET.SubElement(
            policy_hash, "{http://www.w3.org/2000/09/xmldsig#}DigestValue"
        )
        policy_digest_value.text = generate_mock_digest()

        # Signer Role
        signer_role = ET.SubElement(
            signed_sig_props, "{http://uri.etsi.org/01903/v1.3.2#}SignerRoleV2"
        )
        claimed_roles = ET.SubElement(
            signer_role, "{http://uri.etsi.org/01903/v1.3.2#}ClaimedRoles"
        )
        claimed_role = ET.SubElement(
            claimed_roles, "{http://uri.etsi.org/01903/v1.3.2#}ClaimedRole"
        )
        claimed_role.text = "KERNEL"

        # Signed Data Object Properties
        signed_data_props = ET.SubElement(
            signed_props,
            "{http://uri.etsi.org/01903/v1.3.2#}SignedDataObjectProperties",
        )
        data_obj_format = ET.SubElement(
            signed_data_props, "{http://uri.etsi.org/01903/v1.3.2#}DataObjectFormat"
        )
        data_obj_format.set("ObjectReference", "#r-id-ttn")
        mime_type = ET.SubElement(
            data_obj_format, "{http://uri.etsi.org/01903/v1.3.2#}MimeType"
        )
        mime_type.text = "application/octet-stream"

        # Append RefTtnVal and TTN Signature to root
        root.append(ref_ttn_val)
        root.append(sig_ttn)

        # Convert back to string with proper formatting
        xml_str = ET.tostring(root, encoding="unicode")

        # Pretty print
        dom = minidom.parseString(xml_str)
        return dom.toprettyxml(indent="  ", encoding="UTF-8").decode(
            "utf-8"
        ), ttn_reference

    except Exception as e:
        raise Exception(f"Error adding TTN signature: {str(e)}")


def authenticate(login, password, matricule):
    """Mock authentication - accepts any valid inputs for testing"""
    if not login or not password or not matricule:
        return False, "Missing authentication parameters"

    # Mock validation - in real system this would check against database
    if len(matricule) < 7:  # Tunisian matricule fiscale format
        return False, "Invalid matricule fiscale format"

    return True, "Authenticated"


# ============================================================================
# TTN Web Service Operations
# Based on official WSDL: https://elfatoora.tn/ElfatouraServices/EfactService
# ============================================================================


@app.route("/ElfatouraServices/EfactService", methods=["POST"])
def efact_service():
    """
    TTN El Fatoora SOAP Web Service Endpoint
    ---
    tags:
      - SOAP Operations
    summary: Main SOAP endpoint for TTN El Fatoora
    description: |
      Handles all TTN El Fatoora SOAP operations:
      - **saveEfact**: Submit and sign an invoice (TEIF format)
      - **consultEfact**: Query invoices by criteria
      - **verifyQrCode**: Verify QR code (CEV)

      **Authentication Required:**
      - login: Username
      - password: Password
      - matricule: Fiscal number (matricule fiscale)

      **Example SOAP Request (saveEfact):**
      ```xml
      <?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <saveEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
            <login>testuser</login>
            <password>testpass</password>
            <matricule>1234567ABC</matricule>
            <documentEfact>PD94bWwgdmVyc2lvbj0iMS4wIj8+...</documentEfact>
          </saveEfact>
        </soap:Body>
      </soap:Envelope>
      ```

      **Example SOAP Request (consultEfact):**
      ```xml
      <?xml version="1.0" encoding="UTF-8"?>
      <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
        <soap:Body>
          <consultEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
            <login>testuser</login>
            <password>testpass</password>
            <matricule>1234567ABC</matricule>
            <efactCriteria>
              <generatedRef>0736202X20260213...</generatedRef>
            </efactCriteria>
          </consultEfact>
        </soap:Body>
      </soap:Envelope>
      ```
    consumes:
      - text/xml
      - application/xml
    produces:
      - text/xml
    parameters:
      - name: SOAP Request
        in: body
        required: true
        description: SOAP envelope containing operation and parameters
        schema:
          type: string
          example: |
            <?xml version="1.0" encoding="UTF-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <saveEfact xmlns="http://services.elfatoura.tradenet.com.tn/">
                  <login>testuser</login>
                  <password>testpass</password>
                  <matricule>1234567ABC</matricule>
                  <documentEfact>BASE64_ENCODED_XML</documentEfact>
                </saveEfact>
              </soap:Body>
            </soap:Envelope>
    responses:
      200:
        description: SOAP response
        schema:
          type: string
          example: |
            <?xml version="1.0" encoding="UTF-8"?>
            <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
              <soap:Body>
                <saveEfactResponse xmlns="http://services.elfatoura.tradenet.com.tn/">
                  <return>SUCCESS: Invoice saved successfully. idSaveEfact=100000, Reference TTN=0736202X202602131200...</return>
                </saveEfactResponse>
              </soap:Body>
            </soap:Envelope>
      400:
        description: Invalid SOAP request
      500:
        description: Server error
    """
    try:
        # Parse SOAP request
        soap_body = request.data.decode("utf-8")

        # Determine which operation is being called
        if "saveEfact" in soap_body:
            return handle_save_efact(soap_body)
        elif "consultEfact" in soap_body:
            return handle_consult_efact(soap_body)
        elif "verifyQrCode" in soap_body:
            return handle_verify_qrcode(soap_body)
        else:
            return create_soap_fault("Invalid operation"), 500

    except Exception as e:
        return create_soap_fault(str(e)), 500


def handle_save_efact(soap_body):
    """
    Handle saveEfact operation
    Parameters: login, password, matricule, documentEfact (byte[])
    Returns: String message
    """
    global id_counter

    try:
        # Parse SOAP envelope to extract parameters
        root = ET.fromstring(soap_body.encode("utf-8"))

        # Extract parameters from SOAP body
        ns = {
            "soap": "http://schemas.xmlsoap.org/soap/envelope/",
            "tns": "http://services.elfatoura.tradenet.com.tn/",
        }

        body = root.find(".//tns:saveEfact", ns)
        if body is None:
            # Try without namespace
            body = root.find(".//saveEfact")

        if body is None:
            return create_soap_fault("Invalid SOAP request structure"), 400

        # Flexible parameter extraction - handle all namespace scenarios
        def extract_param(elem, param_name):
            """Extract parameter value trying all possible methods"""
            # Method 1: Direct child with no namespace
            child = elem.find(param_name)
            if child is not None and child.text:
                return child.text.strip()

            # Method 2: Direct child with tns namespace
            child = elem.find(f"tns:{param_name}", ns)
            if child is not None and child.text:
                return child.text.strip()

            # Method 3: Descendant search (any level)
            child = elem.find(f".//{param_name}")
            if child is not None and child.text:
                return child.text.strip()

            # Method 4: With full TTN namespace
            child = elem.find(f"{{{ns['tns']}}}{param_name}")
            if child is not None and child.text:
                return child.text.strip()

            # Method 5: Wildcard namespace search
            for child_elem in elem.iter():
                if child_elem.tag.endswith(param_name) and child_elem.text:
                    return child_elem.text.strip()

            # Method 6: Using findtext with various paths
            val = elem.findtext(param_name)
            if val:
                return val.strip()

            val = elem.findtext(f".//{param_name}")
            if val:
                return val.strip()

            return ""

        login = extract_param(body, "login")
        password = extract_param(body, "password")
        matricule = extract_param(body, "matricule")
        document_efact_b64 = extract_param(body, "documentEfact")

        # Debug logging to help troubleshoot
        print(
            f"DEBUG: Extracted parameters - login: '{login}', password: '{password}', matricule: '{matricule}', documentEfact length: {len(document_efact_b64)}"
        )

        # Authenticate
        auth_ok, auth_msg = authenticate(login, password, matricule)
        if not auth_ok:
            return create_save_efact_response(f"Authentication failed: {auth_msg}"), 200

        # Decode base64 document
        try:
            document_efact = base64.b64decode(document_efact_b64).decode("utf-8")
        except Exception:
            return create_save_efact_response(
                "Invalid document encoding. Expected base64 encoded XML."
            ), 200

        # Validate XML structure
        try:
            ET.fromstring(document_efact)
        except ET.ParseError as e:
            return create_save_efact_response(f"Invalid XML format: {str(e)}"), 200

        # Add TTN signature
        signed_xml, ttn_reference = add_ttn_signature_to_xml(document_efact)

        # Generate unique idSaveEfact from database
        id_save_efact = get_next_id()

        # Prepare invoice data
        invoice_id = str(uuid.uuid4())
        invoice_data = {
            "id": invoice_id,
            "id_save_efact": id_save_efact,
            "generated_ref": ttn_reference,
            "document_number": extract_document_number(document_efact),
            "matricule": matricule,
            "date_process": datetime.now().isoformat(),
            "xml_content": signed_xml,
            "status": "VALIDATED",
        }

        # Save to SQLite database
        save_invoice(invoice_data)

        # Success message
        response_msg = f"SUCCESS: Invoice saved successfully. idSaveEfact={id_save_efact}, Reference TTN={ttn_reference}"

        return create_save_efact_response(response_msg), 200

    except Exception as e:
        return create_save_efact_response(f"ERROR: {str(e)}"), 200


def handle_consult_efact(soap_body):
    """
    Handle consultEfact operation
    Parameters: login, password, matricule, efactCriteria
    Returns: List<EfactCriteria>
    """
    try:
        # Parse SOAP envelope
        root = ET.fromstring(soap_body.encode("utf-8"))

        ns = {
            "soap": "http://schemas.xmlsoap.org/soap/envelope/",
            "tns": "http://services.elfatoura.tradenet.com.tn/",
        }

        body = root.find(".//tns:consultEfact", ns)
        if body is None:
            body = root.find(".//consultEfact")

        if body is None:
            return create_soap_fault("Invalid SOAP request structure"), 400

        # Flexible parameter extraction
        def extract_param(elem, param_name):
            """Extract parameter value trying all possible methods"""
            child = elem.find(param_name)
            if child is not None and child.text:
                return child.text.strip()
            child = elem.find(f"tns:{param_name}", ns)
            if child is not None and child.text:
                return child.text.strip()
            child = elem.find(f".//{param_name}")
            if child is not None and child.text:
                return child.text.strip()
            child = elem.find(f"{{{ns['tns']}}}{param_name}")
            if child is not None and child.text:
                return child.text.strip()
            for child_elem in elem.iter():
                if child_elem.tag.endswith(param_name) and child_elem.text:
                    return child_elem.text.strip()
            val = elem.findtext(param_name)
            if val:
                return val.strip()
            val = elem.findtext(f".//{param_name}")
            if val:
                return val.strip()
            return ""

        login = extract_param(body, "login")
        password = extract_param(body, "password")
        matricule = extract_param(body, "matricule")

        # Authenticate
        auth_ok, auth_msg = authenticate(login, password, matricule)
        if not auth_ok:
            return create_consult_efact_response([]), 200

        # Extract search criteria (only add non-empty values)
        criteria = {}

        # Find efactCriteria element (handle namespaces)
        criteria_elem = body.find(".//efactCriteria")
        if criteria_elem is None:
            # Try with wildcard namespace matching
            for elem in body.iter():
                if elem.tag.endswith("efactCriteria"):
                    criteria_elem = elem
                    break
        print(f"DEBUG: criteria_elem found = {criteria_elem is not None}")
        if criteria_elem is not None:
            print(
                f"DEBUG: criteria_elem children: {[child.tag for child in criteria_elem]}"
            )
            print(
                f"DEBUG: criteria_elem all descendants: {[elem.tag for elem in criteria_elem.iter()]}"
            )
        if criteria_elem is not None:
            doc_num = criteria_elem.findtext(".//documentNumber")
            if not doc_num:
                # Try with wildcard namespace matching
                for child in criteria_elem.iter():
                    if child.tag.endswith("documentNumber") and child.text:
                        doc_num = child.text.strip()
                        break
            if doc_num:
                criteria["document_number"] = doc_num

            id_save = criteria_elem.findtext(".//idSaveEfact")
            if not id_save:
                # Try with wildcard namespace matching
                for child in criteria_elem.iter():
                    if child.tag.endswith("idSaveEfact") and child.text:
                        id_save = child.text.strip()
                        break
            if id_save:
                criteria["id_save_efact"] = id_save

            gen_ref = criteria_elem.findtext(".//generatedRef")
            if not gen_ref:
                # Try with wildcard namespace matching
                for child in criteria_elem.iter():
                    if child.tag.endswith("generatedRef") and child.text:
                        gen_ref = child.text.strip()
                        break
            if gen_ref:
                criteria["generated_ref"] = gen_ref

        # Query invoices from SQLite database
        print(f"DEBUG consultEfact: matricule='{matricule}', criteria={criteria}")
        invoices = query_invoices(matricule, criteria)
        print(f"DEBUG consultEfact: Found {len(invoices)} invoice(s)")

        # Format results for SOAP response
        results = []
        for invoice in invoices:
            results.append(
                {
                    "documentNumber": invoice.get("document_number"),
                    "idSaveEfact": invoice.get("id_save_efact"),
                    "generatedRef": invoice.get("generated_ref"),
                    "dateProcess": invoice.get("date_process"),
                    "xmlContent": base64.b64encode(
                        invoice.get("xml_content", "").encode()
                    ).decode(),
                }
            )

        return create_consult_efact_response(results), 200

    except Exception as e:
        return create_soap_fault(str(e)), 500


def handle_verify_qrcode(soap_body):
    """
    Handle verifyQrCode operation
    Verifies the QR code (CEV) from an invoice
    """
    try:
        # Parse SOAP envelope
        root = ET.fromstring(soap_body.encode("utf-8"))

        body = root.find(".//{*}verifyQrCode")
        if body is None:
            return create_soap_fault("Invalid SOAP request structure"), 400

        qr_code = body.findtext(".//qrCode", default="")

        # Mock verification - in real system would validate against database
        if qr_code and len(qr_code) > 100:  # Base64 encoded PNG
            result = "VALID: QR Code verified successfully"
        else:
            result = "INVALID: QR Code verification failed"

        return create_verify_qrcode_response(result), 200

    except Exception as e:
        return create_soap_fault(str(e)), 500


# ============================================================================
# SOAP Response Builders
# ============================================================================


def create_save_efact_response(message):
    """Create SOAP response for saveEfact"""
    soap_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://services.elfatoura.tradenet.com.tn/">
    <soap:Body>
        <tns:saveEfactResponse>
            <return>{message}</return>
        </tns:saveEfactResponse>
    </soap:Body>
</soap:Envelope>"""

    return Response(soap_response, mimetype="text/xml; charset=utf-8")


def create_consult_efact_response(results):
    """Create SOAP response for consultEfact"""
    results_xml = ""
    for r in results:
        results_xml += f"""
        <return>
            <documentNumber>{r.get("documentNumber", "")}</documentNumber>
            <idSaveEfact>{r.get("idSaveEfact", "")}</idSaveEfact>
            <generatedRef>{r.get("generatedRef", "")}</generatedRef>
            <dateProcess>{r.get("dateProcess", "")}</dateProcess>
            <xmlContent>{r.get("xmlContent", "")}</xmlContent>
        </return>"""

    soap_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://services.elfatoura.tradenet.com.tn/">
    <soap:Body>
        <tns:consultEfactResponse>{results_xml}
        </tns:consultEfactResponse>
    </soap:Body>
</soap:Envelope>"""

    return Response(soap_response, mimetype="text/xml; charset=utf-8")


def create_verify_qrcode_response(result):
    """Create SOAP response for verifyQrCode"""
    soap_response = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://services.elfatoura.tradenet.com.tn/">
    <soap:Body>
        <tns:verifyQrCodeResponse>
            <return>{result}</return>
        </tns:verifyQrCodeResponse>
    </soap:Body>
</soap:Envelope>"""

    return Response(soap_response, mimetype="text/xml; charset=utf-8")


def create_soap_fault(message):
    """Create SOAP fault response"""
    soap_fault = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
    <soap:Body>
        <soap:Fault>
            <faultcode>soap:Server</faultcode>
            <faultstring>{message}</faultstring>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>"""

    return Response(soap_fault, mimetype="text/xml; charset=utf-8")


def extract_document_number(xml_content):
    """Extract document number from invoice XML"""
    try:
        root = ET.fromstring(xml_content)
        doc_id = root.find(".//DocumentIdentifier")
        return doc_id.text if doc_id is not None else None
    except Exception:
        return None


# ============================================================================
# WSDL and Service Description
# ============================================================================


@app.route("/ElfatouraServices/EfactService?wsdl", methods=["GET"])
def get_wsdl():
    """
    Get WSDL Definition
    ---
    tags:
      - Service Info
    summary: Retrieve the WSDL definition for the SOAP service
    description: |
      Returns the Web Services Description Language (WSDL) definition for the TTN El Fatoora service.

      The WSDL describes the service interface and available operations:
      - saveEfact
      - consultEfact
      - verifyQrCode
    produces:
      - text/xml
    responses:
      200:
        description: WSDL XML definition
        schema:
          type: string
    """
    wsdl = """<?xml version="1.0" encoding="UTF-8"?>
<definitions targetNamespace="http://services.elfatoura.tradenet.com.tn/" 
             name="EfactServiceService"
             xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="http://services.elfatoura.tradenet.com.tn/"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    
    <types>
        <xsd:schema targetNamespace="http://services.elfatoura.tradenet.com.tn/">
            <!-- Type definitions would go here in full implementation -->
        </xsd:schema>
    </types>
    
    <message name="saveEfact">
        <part name="login" type="xsd:string"/>
        <part name="password" type="xsd:string"/>
        <part name="matricule" type="xsd:string"/>
        <part name="documentEfact" type="xsd:base64Binary"/>
    </message>
    
    <message name="saveEfactResponse">
        <part name="return" type="xsd:string"/>
    </message>
    
    <message name="consultEfact">
        <part name="login" type="xsd:string"/>
        <part name="password" type="xsd:string"/>
        <part name="matricule" type="xsd:string"/>
        <part name="efactCriteria" type="tns:EfactCriteria"/>
    </message>
    
    <message name="consultEfactResponse">
        <part name="return" type="tns:EfactCriteria"/>
    </message>
    
    <message name="verifyQrCode">
        <part name="qrCode" type="xsd:string"/>
    </message>
    
    <message name="verifyQrCodeResponse">
        <part name="return" type="xsd:string"/>
    </message>
    
    <portType name="EfactService">
        <operation name="saveEfact">
            <input message="tns:saveEfact"/>
            <output message="tns:saveEfactResponse"/>
        </operation>
        <operation name="consultEfact">
            <input message="tns:consultEfact"/>
            <output message="tns:consultEfactResponse"/>
        </operation>
        <operation name="verifyQrCode">
            <input message="tns:verifyQrCode"/>
            <output message="tns:verifyQrCodeResponse"/>
        </operation>
    </portType>
    
    <binding name="EfactServicePortBinding" type="tns:EfactService">
        <soap:binding transport="http://schemas.xmlsoap.org/soap/http" style="document"/>
        <operation name="saveEfact">
            <soap:operation soapAction=""/>
            <input><soap:body use="literal"/></input>
            <output><soap:body use="literal"/></output>
        </operation>
        <operation name="consultEfact">
            <soap:operation soapAction=""/>
            <input><soap:body use="literal"/></input>
            <output><soap:body use="literal"/></output>
        </operation>
        <operation name="verifyQrCode">
            <soap:operation soapAction=""/>
            <input><soap:body use="literal"/></input>
            <output><soap:body use="literal"/></output>
        </operation>
    </binding>
    
    <service name="EfactServiceService">
        <port name="EfactServicePort" binding="tns:EfactServicePortBinding">
            <soap:address location="http://localhost:5000/ElfatouraServices/EfactService"/>
        </port>
    </service>
</definitions>"""

    return Response(wsdl, mimetype="text/xml")


@app.route("/", methods=["GET"])
def index():
    """
    Service Information
    ---
    tags:
      - Service Info
    summary: Get service information and status
    description: |
      Returns general information about the TTN El Fatoora mock service including:
      - Service version
      - Available operations
      - WSDL and endpoint URLs
      - Documentation reference
    produces:
      - application/json
    responses:
      200:
        description: Service information
        schema:
          type: object
          properties:
            service:
              type: string
              example: "TTN El Fatoora Mock Web Services"
            version:
              type: string
              example: "5.0-MOCK"
            description:
              type: string
            wsdl:
              type: string
              example: "http://localhost:5000/ElfatouraServices/EfactService?wsdl"
            endpoint:
              type: string
              example: "http://localhost:5000/ElfatouraServices/EfactService"
            operations:
              type: object
            documentation:
              type: string
            timestamp:
              type: string
              format: date-time
    """
    return jsonify(
        {
            "service": "TTN El Fatoora Mock Web Services",
            "version": "5.0-MOCK",
            "description": "Mock implementation matching official TTN specifications",
            "wsdl": "http://localhost:5000/ElfatouraServices/EfactService?wsdl",
            "endpoint": "http://localhost:5000/ElfatouraServices/EfactService",
            "operations": {
                "saveEfact": "Submit a signed invoice (TEIF format)",
                "consultEfact": "Query invoices by criteria",
                "verifyQrCode": "Verify QR code (CEV)",
            },
            "documentation": "Specifications techniques Web Services El Fatoora v5.0",
            "timestamp": datetime.now().isoformat(),
        }
    ), 200


if __name__ == "__main__":
    print("=" * 70)
    print("TTN El Fatoora Mock Web Services")
    print("Based on: Specifications techniques Web Services El Fatoora v5.0")
    print("=" * 70)
    print("\nSwagger API Documentation:")
    print("  http://localhost:5000/api/docs")
    print("\nWSDL URL:")
    print("  http://localhost:5000/ElfatouraServices/EfactService?wsdl")
    print("\nSOAP Endpoint:")
    print("  http://localhost:5000/ElfatouraServices/EfactService")
    print("\nOperations:")
    print("  - saveEfact(login, password, matricule, documentEfact)")
    print("  - consultEfact(login, password, matricule, efactCriteria)")
    print("  - verifyQrCode(qrCode)")
    print("\nStarting server on http://localhost:5001")
    print("=" * 70)

    app.run(host="0.0.0.0", port=5001, debug=True)

# amriaymen@medicacom.tn
