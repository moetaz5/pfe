package com.pfe.signature;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.eclipse.jetty.server.Server;
import org.eclipse.jetty.servlet.ServletContextHandler;

import javax.servlet.http.*;
import javax.swing.*;
import javax.smartcardio.*;
import java.awt.*;
import java.awt.event.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Base64;
import java.util.List;
import java.util.Map;

public class SignatureHttpServer {

    private static JFrame frame;
    private static StatusCard engineCard, tokenCard;
    private static volatile boolean tokenConnected = false;
    private static volatile float globalHue = 0.55f;

    public static void main(String[] args) throws Exception {
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
            startTokenPoller();
            server.join();
        } catch (Exception e) {
            e.printStackTrace();
            System.exit(1);
        }
    }

    private static void startTokenPoller() {
        Thread t = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                refreshDetection();
                try { Thread.sleep(1500); } catch (InterruptedException e) { break; }
            }
        }, "poller");
        t.setDaemon(true); t.start();
    }

    private static void refreshDetection() {
        try {
            // Force refresh PC/SC
            TerminalFactory factory = TerminalFactory.getInstance("PC/SC", null);
            List<CardTerminal> list = factory.terminals().list();
            boolean found = false;
            for (CardTerminal terminal : list) {
                if (terminal.isCardPresent()) { found = true; break; }
            }
            tokenConnected = found;
        } catch (Exception e) {
            tokenConnected = false;
        }
    }

    private static void createAndShowGUI() {
        frame = new JFrame("TunTrust Signature Engine");
        frame.setSize(640, 480); // Un peu plus haut pour le bouton
        frame.setLocationRelativeTo(null);
        frame.setDefaultCloseOperation(JFrame.HIDE_ON_CLOSE);
        frame.setContentPane(buildMainPanel());
        showFrame();
    }

    private static JPanel buildMainPanel() {
        JPanel root = new JPanel(new BorderLayout()) {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g;
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setPaint(new GradientPaint(0,0,new Color(12,18,35), getWidth(), getHeight(), Color.getHSBColor(globalHue, 0.6f, 0.15f)));
                g2.fillRect(0,0,getWidth(),getHeight());
            }
        };

        JPanel cards = new JPanel(new GridLayout(1, 2, 25, 0));
        cards.setOpaque(false);
        cards.setBorder(BorderFactory.createEmptyBorder(50, 45, 20, 45));
        engineCard = new StatusCard("Moteur", "Moteur est connecte", true, Color.CYAN);
        tokenCard  = new StatusCard("Cle TunTrust", "Initialisation...", false, Color.GRAY);
        cards.add(engineCard); cards.add(tokenCard);

        // Bouton Actualiser
        JPanel south = new JPanel(new FlowLayout(FlowLayout.CENTER, 0, 30));
        south.setOpaque(false);
        JButton refreshBtn = new JButton("Actualiser la connexion") {
            @Override protected void paintComponent(Graphics g) {
                Graphics2D g2 = (Graphics2D) g;
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setColor(getModel().isPressed() ? new Color(30,50,90) : new Color(45,70,120));
                g2.fill(new RoundRectangle2D.Float(0,0,getWidth(),getHeight(),15,15));
                g2.setColor(Color.WHITE);
                g2.setFont(new Font("Segoe UI", Font.BOLD, 14));
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(getText(), (getWidth()-fm.stringWidth(getText()))/2, (getHeight()+fm.getAscent())/2 - 3);
            }
        };
        refreshBtn.setPreferredSize(new Dimension(220, 45));
        refreshBtn.setContentAreaFilled(false);
        refreshBtn.setFocusPainted(false);
        refreshBtn.setBorderPainted(false);
        refreshBtn.setForeground(Color.WHITE);
        refreshBtn.setCursor(new Cursor(Cursor.HAND_CURSOR));
        refreshBtn.addActionListener(e -> {
            new Thread(() -> {
                refreshDetection();
                SwingUtilities.invokeLater(() -> {
                    boolean c = tokenConnected;
                    tokenCard.updateStatus(c ? "Cle est connectee" : "Cle non connectee", c, c ? Color.GREEN : Color.RED);
                    frame.repaint();
                });
            }).start();
        });
        south.add(refreshBtn);

        root.add(cards, BorderLayout.CENTER);
        root.add(south, BorderLayout.SOUTH);

        new Timer(40, e -> {
            globalHue += 0.0015f; if (globalHue > 1.0f) globalHue = 0.0f;
            boolean c = tokenConnected;
            tokenCard.updateStatus(c ? "Cle est connectee" : "Cle non connectee", c, c ? new Color(50,250,110) : new Color(255,50,50));
            root.repaint();
        }).start();

        return root;
    }

    static class StatusCard extends JPanel {
        private String label, text;
        private boolean active;
        private Color color;
        private float p = 0;
        StatusCard(String l, String t, boolean a, Color c) {
            this.label=l; this.text=t; this.active=a; this.color=c; setOpaque(false);
            new Timer(40, e -> { p += 0.1f; repaint(); }).start();
        }
        void updateStatus(String t, boolean a, Color c) { this.text=t; this.active=a; this.color=c; }
        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g; g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            int w=getWidth(), h=getHeight();
            g2.setColor(new Color(255,255,255,18)); g2.fill(new RoundRectangle2D.Float(0,0,w,h,25,25));
            g2.setColor(active ? color : new Color(100,100,100)); g2.setStroke(new BasicStroke(active?3:1));
            g2.draw(new RoundRectangle2D.Float(2,2,w-4,h-4,25,25));
            g2.setFont(new Font("Segoe UI", Font.BOLD, 15)); g2.setColor(new Color(180,200,240));
            g2.drawString(label, (w-g2.getFontMetrics().stringWidth(label))/2, 40);
            int r=20, cx=w/2, cy=h/2;
            if (active) {
                float a = 0.15f + (float)(Math.sin(p)*0.1);
                g2.setColor(new Color(color.getRed(), color.getGreen(), color.getBlue(), (int)(a*255)));
                g2.fillOval(cx-r-12, cy-r-12, (r+12)*2, (r+12)*2);
            }
            g2.setColor(active ? color : new Color(60,60,60)); g2.fillOval(cx-r, cy-r, r*2, r*2);
            g2.setFont(new Font("Segoe UI Semibold", Font.PLAIN, 13)); g2.setColor(Color.WHITE);
            g2.drawString(text, (w-g2.getFontMetrics().stringWidth(text))/2, h-40);
        }
    }

    private static void showFrame() { if (frame != null) { frame.setVisible(true); frame.toFront(); } }
    private static Image createTrayImage() {
        BufferedImage img = new BufferedImage(16,16,BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics(); g.setColor(Color.GREEN); g.fillOval(2,2,12,12); g.dispose();
        return img;
    }

    private static void setCors(HttpServletResponse r) {
        r.setHeader("Access-Control-Allow-Origin", "*");
        r.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        r.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }
    public static class PingServlet extends HttpServlet {
        @Override protected void doGet(HttpServletRequest rq, HttpServletResponse rs) throws IOException { setCors(rs); rs.getWriter().write("{\"status\":\"ok\"}"); }
        @Override protected void doOptions(HttpServletRequest rq, HttpServletResponse rs) { setCors(rs); }
    }
    public static class UiShowServlet extends HttpServlet {
        @Override protected void doGet(HttpServletRequest rq, HttpServletResponse rs) throws IOException { setCors(rs); showFrame(); rs.getWriter().write("ok"); }
        @Override protected void doOptions(HttpServletRequest rq, HttpServletResponse rs) { setCors(rs); }
    }
    public static class SignServlet extends HttpServlet {
        private final ObjectMapper m = new ObjectMapper();
        @Override protected void doPost(HttpServletRequest rq, HttpServletResponse rs) throws IOException {
            setCors(rs); rs.setContentType("application/json");
            try {
                Map<String, Object> body = m.readValue(rq.getInputStream(), Map.class);
                String pin = (String) body.get("pin"), xml = (String) body.get("xmlBase64");
                if (pin == null || pin.isEmpty()) { rs.setStatus(400); return; }
                if (Boolean.TRUE.equals(body.get("checkOnly"))) { KeyStoreLoader.openSession(pin); rs.getWriter().write("{\"pin\":\"valid\"}"); return; }
                KeyStoreLoader.SessionContext s = KeyStoreLoader.openSession(pin);
                byte[] data = Base64.getDecoder().decode(xml);
                byte[] signed = XmlXadesSigner.signTradeNetLike(data, s.getPrivateKey(), s.getCertificate());
                rs.getWriter().write("{\"signedXmlBase64\":\"" + Base64.getEncoder().encodeToString(signed) + "\"}");
            } catch (Exception e) { rs.setStatus(500); rs.getWriter().write("{\"error\":\"" + e.getMessage() + "\"}"); }
        }
        @Override protected void doOptions(HttpServletRequest rq, HttpServletResponse rs) { setCors(rs); }
    }
}
