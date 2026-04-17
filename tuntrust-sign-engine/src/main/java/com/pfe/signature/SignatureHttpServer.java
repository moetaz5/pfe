package com.pfe.signature;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;

import javax.servlet.http.*;
import javax.swing.*;
import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
import java.util.Map;

public class SignatureHttpServer {

    private static JFrame frame;
    private static float hue = 0.55f;

    public static void main(String[] args) throws Exception {
        // --- Single Instance Signal ---
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL("http://127.0.0.1:9000/ui/show").openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(400);
            if (connection.getResponseCode() == 200) { System.exit(0); return; }
        } catch (Exception ignored) {}

        KeyStoreLoader.init();

        Server server = new Server(9000);
        ServletContextHandler context = new ServletContextHandler();
        context.setContextPath("/");
        server.setHandler(context);

        context.addServlet(PingServlet.class, "/ping");
        context.addServlet(SignServlet.class, "/sign/xml");
        context.addServlet(UiShowServlet.class, "/ui/show");

        if (!GraphicsEnvironment.isHeadless()) {
            SwingUtilities.invokeLater(SignatureHttpServer::createAndShowGUI);
        }

        try {
            server.start();
            server.join();
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static void createAndShowGUI() {
        frame = new JFrame("TunTrust Signature Engine");
        frame.setSize(680, 450);
        frame.setLocationRelativeTo(null);
        frame.setDefaultCloseOperation(JFrame.HIDE_ON_CLOSE);
        frame.setResizable(false);

        JPanel mainPanel = new JPanel(new BorderLayout()) {
            { new Timer(40, e -> { hue += 0.0015f; repaint(); }).start(); }
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g;
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                Color c1 = new Color(10, 15, 30);
                Color c2 = Color.getHSBColor(hue % 1.0f, 0.65f, 0.22f);
                g2.setPaint(new GradientPaint(0, 0, c1, getWidth(), getHeight(), c2));
                g2.fillRect(0, 0, getWidth(), getHeight());
            }
        };

        // Header section
        JPanel header = new JPanel(new FlowLayout(FlowLayout.CENTER, 0, 20));
        header.setOpaque(false);
        JLabel title = new JLabel("TUNTRUST SIGNATURE ENGINE");
        title.setFont(new Font("Segoe UI", Font.BOLD, 22));
        title.setForeground(Color.WHITE);
        header.add(title);
        mainPanel.add(header, BorderLayout.NORTH);

        // Center Content
        JPanel center = new JPanel();
        center.setOpaque(false);
        center.setLayout(new BoxLayout(center, BoxLayout.Y_AXIS));
        center.setBorder(BorderFactory.createEmptyBorder(20, 50, 20, 50));

        // Engine Status Card (Main Focus)
        StatusCard engineCard = new StatusCard("MOTEUR DE SIGNATURE", "SERVICE ACTIF", true, new Color(0, 255, 150));
        engineCard.setAlignmentX(Component.CENTER_ALIGNMENT);
        center.add(engineCard);
        center.add(Box.createVerticalStrut(30));

        // Info / Instruction Panel (Glassmorphism style)
        JPanel infoBox = new JPanel(new BorderLayout()) {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g;
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setColor(new Color(255, 255, 255, 15));
                g2.fill(new RoundRectangle2D.Float(0, 0, getWidth(), getHeight(), 15, 15));
                g2.setColor(new Color(255, 255, 255, 30));
                g2.draw(new RoundRectangle2D.Float(0, 0, getWidth()-1, getHeight()-1, 15, 15));
            }
        };
        infoBox.setOpaque(false);
        infoBox.setPreferredSize(new Dimension(500, 100));
        infoBox.setMaximumSize(new Dimension(580, 100));
        infoBox.setBorder(BorderFactory.createEmptyBorder(15, 20, 15, 20));

        JLabel infoText = new JLabel("<html><div style='text-align: center;'>Veuillez brancher votre cle TunTrust pour pouvoir vous connecter<br>a MedicaSign et effectuer vos signatures electroniques.</div></html>");
        infoText.setFont(new Font("Segoe UI", Font.PLAIN, 14));
        infoText.setForeground(new Color(200, 210, 255));
        infoText.setHorizontalAlignment(SwingConstants.CENTER);
        infoBox.add(infoText, BorderLayout.CENTER);
        
        center.add(infoBox);
        mainPanel.add(center, BorderLayout.CENTER);

        // Footer
        JLabel footer = new JLabel("MedicaSign Engine v1.2 | TunTrust PKCS11 Configuration", SwingConstants.CENTER);
        footer.setFont(new Font("Segoe UI", Font.PLAIN, 11));
        footer.setForeground(new Color(100, 120, 160));
        footer.setBorder(BorderFactory.createEmptyBorder(0, 0, 15, 0));
        mainPanel.add(footer, BorderLayout.SOUTH);

        frame.setContentPane(mainPanel);
        
        if (SystemTray.isSupported()) {
            try {
                TrayIcon trayIcon = new TrayIcon(createTrayImage(), "TunTrust Engine");
                trayIcon.setImageAutoSize(true);
                trayIcon.addActionListener(e -> showFrame());
                SystemTray.getSystemTray().add(trayIcon);
            } catch (Exception ignored) {}
        }
        
        showFrame();
    }

    static class StatusCard extends JPanel {
        private String l1, l2;
        private boolean active;
        private Color accent;
        private float pulse = 0;

        StatusCard(String l1, String l2, boolean active, Color accent) {
            this.l1 = l1; this.l2 = l2; this.active = active; this.accent = accent;
            setPreferredSize(new Dimension(280, 160));
            setMaximumSize(new Dimension(280, 160));
            setOpaque(false);
            new Timer(40, e -> { pulse += 0.08f; repaint(); }).start();
        }

        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            int w = getWidth(), h = getHeight();
            
            g2.setColor(new Color(255, 255, 255, 20));
            g2.fill(new RoundRectangle2D.Float(0, 0, w, h, 20, 20));
            
            float alpha = 0.2f + (float)(Math.sin(pulse)*0.1f + 0.1f);
            g2.setColor(new Color(accent.getRed(), accent.getGreen(), accent.getBlue(), (int)(alpha*255)));
            g2.setStroke(new BasicStroke(3));
            g2.draw(new RoundRectangle2D.Float(2, 2, w-4, h-4, 20, 20));

            g2.setFont(new Font("Segoe UI", Font.BOLD, 14));
            g2.setColor(new Color(180, 200, 255));
            g2.drawString(l1, (w - g2.getFontMetrics().stringWidth(l1))/2, 40);

            int r = 18;
            int cx = w/2, cy = h/2 + 5;
            g2.setColor(new Color(accent.getRed(), accent.getGreen(), accent.getBlue(), 50));
            int grow = (int)(Math.sin(pulse)*5);
            g2.fillOval(cx-r-grow, cy-r-grow, (r+grow)*2, (r+grow)*2);
            g2.setColor(accent);
            g2.fillOval(cx-r, cy-r, r*2, r*2);

            g2.setFont(new Font("Segoe UI Semibold", Font.PLAIN, 16));
            g2.setColor(Color.WHITE);
            g2.drawString(l2, (w - g2.getFontMetrics().stringWidth(l2))/2, h - 30);
        }
    }

    private static void showFrame() { if (frame != null) { frame.setVisible(true); frame.toFront(); } }
    
    private static Image createTrayImage() {
        BufferedImage img = new BufferedImage(16, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(0, 255, 120)); g.fillOval(2, 2, 12, 12); g.dispose();
        return img;
    }

    private static void setCorsHeaders(HttpServletResponse resp) {
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    public static class PingServlet extends HttpServlet {
        @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            setCorsHeaders(resp); resp.getWriter().write("{\"status\":\"ok\"}");
        }
        @Override protected void doOptions(HttpServletRequest req, HttpServletResponse resp) { setCorsHeaders(resp); }
    }

    public static class UiShowServlet extends HttpServlet {
        @Override protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            setCorsHeaders(resp); showFrame(); resp.getWriter().write("ok");
        }
        @Override protected void doOptions(HttpServletRequest req, HttpServletResponse resp) { setCorsHeaders(resp); }
    }

    public static class SignServlet extends HttpServlet {
        private final ObjectMapper mapper = new ObjectMapper();
        @Override protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws IOException {
            setCorsHeaders(resp); resp.setContentType("application/json");
            try {
                Map<String, Object> body = mapper.readValue(req.getInputStream(), Map.class);
                String pin = (String) body.get("pin");
                if (pin == null || pin.isEmpty()) { resp.setStatus(400); return; }
                if (Boolean.TRUE.equals(body.get("checkOnly"))) { KeyStoreLoader.openSession(pin); resp.getWriter().write("{\"pin\":\"valid\"}"); return; }
                KeyStoreLoader.SessionContext session = KeyStoreLoader.openSession(pin);
                byte[] signed = XmlXadesSigner.signTradeNetLike(Base64.getDecoder().decode((String)body.get("xmlBase64")), session.getPrivateKey(), session.getCertificate());
                resp.getWriter().write("{\"signedXmlBase64\":\"" + Base64.getEncoder().encodeToString(signed) + "\"}");
            } catch (Exception e) { resp.setStatus(500); resp.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}"); }
        }
        @Override protected void doOptions(HttpServletRequest req, HttpServletResponse resp) { setCorsHeaders(resp); }
    }
}
