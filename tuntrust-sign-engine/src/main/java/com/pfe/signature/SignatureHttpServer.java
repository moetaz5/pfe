package com.pfe.signature;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;

import javax.servlet.http.*;
import java.io.IOException;
import java.util.Base64;
import java.util.Map;

public class SignatureHttpServer {

    public static void main(String[] args) throws Exception {
        KeyStoreLoader.init();

        Server server = new Server(9000);
        ServletContextHandler context = new ServletContextHandler();
        context.setContextPath("/");
        server.setHandler(context);

        context.addServlet(PingServlet.class, "/ping");
        context.addServlet(SignServlet.class, "/sign/xml");

        server.start();
        System.out.println("🚀 Signature Engine prêt sur http://127.0.0.1:9000");
        server.join();
    }

    public static class PingServlet extends HttpServlet {
        @Override
        protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            resp.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
            resp.setContentType("application/json");
            resp.getWriter().write("{\"status\":\"ok\"}");
        }
    }

    public static class SignServlet extends HttpServlet {
        private final ObjectMapper mapper = new ObjectMapper();

        @Override
        protected void doOptions(HttpServletRequest req, HttpServletResponse resp) {
            resp.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
            resp.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
            resp.setHeader("Access-Control-Allow-Headers", "Content-Type");
            resp.setStatus(HttpServletResponse.SC_OK);
        }

        @Override
        protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {

            resp.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
            resp.setContentType("application/json");

            try {
                Map<String, Object> body = mapper.readValue(req.getInputStream(), Map.class);

                String pin = (String) body.get("pin");
                String xmlBase64 = (String) body.get("xmlBase64");
                boolean checkOnly = Boolean.TRUE.equals(body.get("checkOnly"));

                if (pin == null || pin.isEmpty()) {
                    resp.setStatus(400);
                    resp.getWriter().write("{\"error\":\"PIN_REQUIRED\"}");
                    return;
                }

                if (checkOnly) {
                    KeyStoreLoader.openSession(pin); // lève SecurityException si PIN faux
                    resp.getWriter().write("{\"pin\":\"valid\"}");
                    return;
                }

                if (xmlBase64 == null || xmlBase64.isEmpty()) {
                    resp.setStatus(400);
                    resp.getWriter().write("{\"error\":\"XML_REQUIRED\"}");
                    return;
                }

                byte[] xml = Base64.getDecoder().decode(xmlBase64);

                // Ouvre une nouvelle session PKCS#11 pour chaque requête (correction PIN mémorisé)
                KeyStoreLoader.SessionContext session = KeyStoreLoader.openSession(pin);

                byte[] signed = XmlXadesSigner.signTradeNetLike(
                        xml,
                        session.getPrivateKey(),
                        session.getCertificate()
                );

                String signedBase64 = Base64.getEncoder().encodeToString(signed);
                resp.getWriter().write("{\"signedXmlBase64\":\"" + signedBase64 + "\"}");

            } catch (SecurityException e) {
                resp.setStatus(401);
                resp.getWriter().write("{\"error\":\"PIN_INCORRECT\"}");
            } catch (Exception e) {
                resp.setStatus(500);
                resp.getWriter().write("{\"error\":\"SIGN_ERROR\",\"message\":\"" + e.getMessage() + "\"}");
                e.printStackTrace();
            }
        }
    }
}
