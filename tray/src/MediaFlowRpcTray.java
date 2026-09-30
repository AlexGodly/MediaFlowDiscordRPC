
import javax.imageio.ImageIO;
import javax.swing.*;
import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.net.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public final class MediaFlowRpcTray {
    private static final String APP_NAME = "MediaFlow RPC";
    private static final String MEDIAFLOW_URL = "https://alexgodly.github.io/MediaFlow/";
    private static final int BRIDGE_PORT = 17372;

    private static TrayIcon trayIcon;
    private static MenuItem statusItem;
    private static Properties config;
    private static Path configDir;
    private static Path configFile;
    private static DiscordIpc discord;
    private static LocalBridge bridge;
    private static Path logFile;
    private static final Object LOG_LOCK = new Object();

    public static void main(String[] args) {
        System.setProperty("java.awt.headless", "false");
        try {
            runMain(args);
        } catch (Throwable t) {
            try { log("FATAL startup error", t); } catch (Throwable ignored) {}
            try {
                JOptionPane.showMessageDialog(null,
                        "MediaFlow RPC could not start.\n\n" + t +
                        "\n\nSee the log in %APPDATA%\\MediaFlow RPC\\MediaFlowRPC.log",
                        APP_NAME, JOptionPane.ERROR_MESSAGE);
            } catch (Throwable ignored) {}
        }
    }

    private static void runMain(String[] args) {
        if (!System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
            JOptionPane.showMessageDialog(null,
                    "MediaFlow RPC is built for Windows.",
                    APP_NAME, JOptionPane.ERROR_MESSAGE);
            return;
        }

        if (!SystemTray.isSupported()) {
            JOptionPane.showMessageDialog(null,
                    "The Windows system tray is not available.",
                    APP_NAME, JOptionPane.ERROR_MESSAGE);
            return;
        }

        loadConfig();
        log("Starting MediaFlow RPC " + System.getProperty("java.version") + " on " + System.getProperty("os.name"));

        try {
            initTray();
        } catch (Exception ex) {
            JOptionPane.showMessageDialog(null,
                    "Could not create the tray icon:\n" + ex.getMessage(),
                    APP_NAME, JOptionPane.ERROR_MESSAGE);
            return;
        }

        log("Tray icon initialized");
        discord = new DiscordIpc();
        discord.setStatusListener(MediaFlowRpcTray::setTrayStatus);
        discord.setClientId(config.getProperty("discordClientId", "").trim());
        discord.start();

        bridge = new LocalBridge(BRIDGE_PORT, discord);
        bridge.setStatusListener(MediaFlowRpcTray::setTrayStatus);
        bridge.start();

        setTrayStatus("Starting local bridge");
        log("Local bridge thread started on 127.0.0.1:" + BRIDGE_PORT);

        String clientId = config.getProperty("discordClientId", "").trim();
        if (!validClientId(clientId)) {
            EventQueue.invokeLater(() -> showSettings(true));
        }
    }

    private static void loadConfig() {
        String appData = System.getenv("APPDATA");
        if (appData == null || appData.isBlank()) {
            appData = System.getProperty("user.home", ".");
        }
        configDir = Paths.get(appData, "MediaFlow RPC");
        configFile = configDir.resolve("config.properties");
        logFile = configDir.resolve("MediaFlowRPC.log");
        config = new Properties();

        try {
            Files.createDirectories(configDir);
            if (Files.exists(configFile)) {
                try (InputStream in = Files.newInputStream(configFile)) {
                    config.load(in);
                }
            }
        } catch (IOException ignored) {}
    }

    private static void log(String message) {
        log(message, null);
    }

    private static void log(String message, Throwable error) {
        try {
            if (configDir == null) {
                String appData = System.getenv("APPDATA");
                if (appData == null || appData.isBlank()) appData = System.getProperty("user.home", ".");
                configDir = Paths.get(appData, "MediaFlow RPC");
                logFile = configDir.resolve("MediaFlowRPC.log");
            }
            Files.createDirectories(configDir);
            synchronized (LOG_LOCK) {
                try (PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter(logFile.toFile(), true)))) {
                    out.println("[" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) + "] " + message);
                    if (error != null) error.printStackTrace(out);
                }
            }
        } catch (Throwable ignored) {}
    }

    private static void saveConfig() {
        try {
            Files.createDirectories(configDir);
            try (OutputStream out = Files.newOutputStream(configFile)) {
                config.store(out, "MediaFlow RPC settings");
            }
        } catch (IOException ex) {
            JOptionPane.showMessageDialog(null,
                    "Could not save settings:\n" + ex.getMessage(),
                    APP_NAME, JOptionPane.ERROR_MESSAGE);
        }
    }

    private static boolean validClientId(String id) {
        return id != null && Pattern.matches("\\d{15,25}", id.trim());
    }

    private static void initTray() throws Exception {
        Image image;
        try (InputStream in = MediaFlowRpcTray.class.getResourceAsStream("/mediaflow.png")) {
            if (in == null) throw new IOException("mediaflow.png resource missing");
            image = ImageIO.read(in);
        }

        PopupMenu menu = new PopupMenu();

        statusItem = new MenuItem("Starting…");
        statusItem.setEnabled(false);
        menu.add(statusItem);

        menu.addSeparator();

        MenuItem openMediaFlow = new MenuItem("Open MediaFlow");
        openMediaFlow.addActionListener(e -> openUrl(MEDIAFLOW_URL));
        menu.add(openMediaFlow);

        MenuItem settings = new MenuItem("Discord Application ID…");
        settings.addActionListener(e -> EventQueue.invokeLater(() -> showSettings(false)));
        menu.add(settings);

        MenuItem diagnostics = new MenuItem("Open Diagnostics");
        diagnostics.addActionListener(e -> openUrl("http://127.0.0.1:" + BRIDGE_PORT + "/status"));
        menu.add(diagnostics);

        MenuItem reconnect = new MenuItem("Reconnect Discord");
        reconnect.addActionListener(e -> {
            if (discord != null) discord.reconnect();
        });
        menu.add(reconnect);

        menu.addSeparator();

        MenuItem exit = new MenuItem("Exit");
        exit.addActionListener(e -> shutdown());
        menu.add(exit);

        trayIcon = new TrayIcon(image, APP_NAME, menu);
        trayIcon.setImageAutoSize(true);
        trayIcon.addActionListener(e -> openUrl(MEDIAFLOW_URL));
        SystemTray.getSystemTray().add(trayIcon);
    }

    private static void showSettings(boolean firstRun) {
        String current = config.getProperty("discordClientId", "").trim();

        JTextField clientId = new JTextField(current, 24);

        JPanel panel = new JPanel();
        panel.setLayout(new BoxLayout(panel, BoxLayout.Y_AXIS));

        JLabel line1 = new JLabel("<html><b>Discord Application ID</b></html>");
        line1.setAlignmentX(Component.LEFT_ALIGNMENT);
        clientId.setAlignmentX(Component.LEFT_ALIGNMENT);

        JLabel help = new JLabel(
                "<html><div style='width:360px'>" +
                "Create a Discord Developer application named <b>MediaFlow</b>, " +
                "copy its Application ID, and paste it here.<br><br>" +
                "No bot token, client secret, OAuth login, or Discord buttons are required." +
                "</div></html>");
        help.setAlignmentX(Component.LEFT_ALIGNMENT);

        panel.add(line1);
        panel.add(Box.createVerticalStrut(6));
        panel.add(clientId);
        panel.add(Box.createVerticalStrut(12));
        panel.add(help);

        int result = JOptionPane.showConfirmDialog(
                null, panel,
                firstRun ? "MediaFlow RPC — First-time setup" : "MediaFlow RPC Settings",
                JOptionPane.OK_CANCEL_OPTION,
                JOptionPane.PLAIN_MESSAGE
        );

        if (result != JOptionPane.OK_OPTION) return;

        String value = clientId.getText().trim();
        if (!validClientId(value)) {
            JOptionPane.showMessageDialog(null,
                    "That does not look like a Discord Application ID.\n" +
                    "It should be a long number copied from the Discord Developer Portal.",
                    APP_NAME, JOptionPane.WARNING_MESSAGE);
            EventQueue.invokeLater(() -> showSettings(firstRun));
            return;
        }

        config.setProperty("discordClientId", value);
        saveConfig();

        if (discord != null) {
            discord.setClientId(value);
            discord.reconnect();
        }

        setTrayStatus("Discord ID saved — reconnecting");
    }

    private static void setTrayStatus(String text) {
        EventQueue.invokeLater(() -> {
            if (statusItem != null) {
                String t = text == null ? "MediaFlow RPC" : text;
                if (t.length() > 70) t = t.substring(0, 67) + "…";
                statusItem.setLabel(t);
            }
            if (trayIcon != null) {
                trayIcon.setToolTip("MediaFlow RPC — " + (text == null ? "" : text));
            }
        });
    }

    private static void openUrl(String url) {
        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(URI.create(url));
            }
        } catch (Exception ignored) {}
    }

    private static void shutdown() {
        try {
            if (bridge != null) bridge.stop();
        } catch (Exception ignored) {}
        try {
            if (discord != null) {
                discord.clearPresence();
                discord.stop();
            }
        } catch (Exception ignored) {}
        try {
            if (trayIcon != null) SystemTray.getSystemTray().remove(trayIcon);
        } catch (Exception ignored) {}
        System.exit(0);
    }

    // ---------------------------------------------------------------------
    // Local browser -> tray bridge.
    // v5 uses short HTTP POSTs from the extension service worker instead of
    // depending on a long-lived MV3 WebSocket. The WebSocket endpoint remains
    // as a backwards-compatible fallback for older extension builds.
    // ---------------------------------------------------------------------
    static final class LocalBridge {
        private final int port;
        private final DiscordIpc discord;
        private volatile boolean running;
        private ServerSocket server;
        private Thread acceptThread;
        private final AtomicInteger clients = new AtomicInteger();
        private final AtomicInteger httpRequests = new AtomicInteger();
        private java.util.function.Consumer<String> statusListener = x -> {};
        private volatile String lastPresenceDetails = "";
        private volatile String lastPresenceState = "";
        private volatile long lastPresenceAt = 0L;
        private volatile long lastExtensionContactAt = 0L;

        LocalBridge(int port, DiscordIpc discord) {
            this.port = port;
            this.discord = discord;
        }

        void setStatusListener(java.util.function.Consumer<String> listener) {
            statusListener = listener == null ? x -> {} : listener;
        }

        void start() {
            running = true;
            acceptThread = new Thread(this::acceptLoop, "MediaFlow-RPC-Bridge");
            acceptThread.setDaemon(true);
            acceptThread.start();
        }

        void stop() {
            running = false;
            try { if (server != null) server.close(); } catch (IOException ignored) {}
        }

        private void acceptLoop() {
            try {
                server = new ServerSocket();
                server.setReuseAddress(true);
                server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), port));
                log("Bridge listening on http://127.0.0.1:" + port + "/presence and ws://127.0.0.1:" + port + "/mediaflow");
                statusListener.accept("Bridge ready — waiting for MediaFlow");
            } catch (IOException ex) {
                log("Bridge bind failed on 127.0.0.1:" + port, ex);
                statusListener.accept("Bridge error — port " + port + " unavailable");
                return;
            }

            while (running) {
                try {
                    Socket socket = server.accept();
                    socket.setTcpNoDelay(true);
                    Thread t = new Thread(() -> handleClient(socket), "MediaFlow-RPC-LocalBridge");
                    t.setDaemon(true);
                    t.start();
                } catch (IOException ex) {
                    if (running) statusListener.accept("Bridge connection error");
                }
            }
        }

        private void handleClient(Socket socket) {
            boolean counted = false;
            try (socket) {
                BufferedInputStream in = new BufferedInputStream(socket.getInputStream());
                BufferedOutputStream out = new BufferedOutputStream(socket.getOutputStream());

                HttpRequest req = readRequest(in);
                if (req == null) return;

                if ("OPTIONS".equals(req.method) && "/presence".equals(req.path)) {
                    if (!allowedOrigin(req.origin)) {
                        writeHttpError(out, 403, "Forbidden", req.origin);
                        return;
                    }
                    writeHttpResponse(out, 204, "No Content", "", req.origin,
                            "Access-Control-Allow-Methods: POST, OPTIONS\r\n" +
                            "Access-Control-Allow-Headers: Content-Type\r\n" +
                            "Access-Control-Max-Age: 86400\r\n");
                    return;
                }

                if ("GET".equals(req.method) && "/health".equals(req.path)) {
                    writeHttpResponse(out, 200, "OK", "MediaFlow RPC bridge is running", req.origin, "");
                    return;
                }

                if ("GET".equals(req.method) && "/status".equals(req.path)) {
                    String bodyText = "MediaFlow RPC diagnostics\n" +
                            "=========================\n" +
                            "Bridge: RUNNING\n" +
                            "Relay transport: HTTP POST (v6)\n" +
                            "HTTP presence requests: " + httpRequests.get() + "\n" +
                            "Active legacy WebSocket clients: " + clients.get() + "\n" +
                            "Last extension contact: " + (lastExtensionContactAt > 0 ? new java.util.Date(lastExtensionContactAt) : "never") + "\n" +
                            "Last MediaFlow activity: " + (lastPresenceAt > 0 ? new java.util.Date(lastPresenceAt) : "never") + "\n" +
                            "Details: " + (lastPresenceDetails.isBlank() ? "(none)" : lastPresenceDetails) + "\n" +
                            "State: " + (lastPresenceState.isBlank() ? "(none)" : lastPresenceState) + "\n\n" +
                            "Discord ready: " + discord.isReady() + "\n" +
                            "Discord status: " + discord.diagnosticStatus() + "\n" +
                            "Discord Application ID: " + discord.diagnosticClientIdMasked() + "\n" +
                            "Discord READY at: " + (discord.diagnosticLastReadyAt() > 0 ? new java.util.Date(discord.diagnosticLastReadyAt()) : "never") + "\n" +
                            "Last SET_ACTIVITY at: " + (discord.diagnosticLastActivitySentAt() > 0 ? new java.util.Date(discord.diagnosticLastActivitySentAt()) : "never") + "\n" +
                            "Last Discord error: " + (discord.diagnosticError().isBlank() ? "(none)" : discord.diagnosticError()) + "\n" +
                            "Last Discord message: " + (discord.diagnosticMessage().isBlank() ? "(none)" : discord.diagnosticMessage()) + "\n";
                    writeHttpResponse(out, 200, "OK", bodyText, req.origin, "");
                    return;
                }

                // v5 primary transport: one short local POST per activity update.
                if ("POST".equals(req.method) && "/presence".equals(req.path)) {
                    if (!allowedOrigin(req.origin)) {
                        writeHttpError(out, 403, "Forbidden", req.origin);
                        return;
                    }
                    lastExtensionContactAt = System.currentTimeMillis();
                    httpRequests.incrementAndGet();
                    String message = new String(req.body, StandardCharsets.UTF_8);
                    handleMessage(message);
                    writeHttpResponse(out, 200, "OK", "OK", req.origin, "");
                    return;
                }

                // Backwards-compatible WebSocket transport.
                if (!"GET".equals(req.method) || !"/mediaflow".equals(req.path) || !allowedOrigin(req.origin)) {
                    writeHttpError(out, 403, "Forbidden", req.origin);
                    return;
                }

                String key = req.headers.get("sec-websocket-key");
                if (key == null || key.isBlank()) {
                    writeHttpError(out, 400, "Bad Request", req.origin);
                    return;
                }

                String accept = websocketAccept(key.trim());
                String response =
                        "HTTP/1.1 101 Switching Protocols\r\n" +
                        "Upgrade: websocket\r\n" +
                        "Connection: Upgrade\r\n" +
                        "Sec-WebSocket-Accept: " + accept + "\r\n" +
                        "\r\n";
                out.write(response.getBytes(StandardCharsets.US_ASCII));
                out.flush();

                clients.incrementAndGet();
                counted = true;
                lastExtensionContactAt = System.currentTimeMillis();
                statusListener.accept("Browser extension connected");
                log("Legacy WebSocket extension connected");

                while (running && !socket.isClosed()) {
                    WsFrame frame = readFrame(in);
                    if (frame == null) break;

                    if (frame.opcode == 0x8) break;
                    if (frame.opcode == 0x9) {
                        writeFrame(out, 0xA, frame.payload);
                        continue;
                    }
                    if (frame.opcode != 0x1) continue;

                    lastExtensionContactAt = System.currentTimeMillis();
                    String message = new String(frame.payload, StandardCharsets.UTF_8);
                    handleMessage(message);
                }
            } catch (Exception ex) {
                log("Local bridge client error", ex);
            } finally {
                if (counted) {
                    clients.updateAndGet(v -> Math.max(0, v - 1));
                    log("Legacy WebSocket extension disconnected");
                }
            }
        }

        private void handleMessage(String message) {
            if (message == null) return;
            if ("MF1|K".equals(message)) return;

            if ("MF1|C".equals(message)) {
                discord.clearPresence();
                statusListener.accept("Waiting for MediaFlow activity");
                log("MediaFlow presence cleared");
                return;
            }

            String[] parts = message.split("\\|", -1);
            if (parts.length < 4 || !"MF1".equals(parts[0]) || !"P".equals(parts[1])) return;

            try {
                String details = decodeBase64(parts[2]);
                String state = decodeBase64(parts[3]);
                lastPresenceDetails = details;
                lastPresenceState = state;
                lastPresenceAt = System.currentTimeMillis();
                Presence p = new Presence(details, state);
                discord.setPresence(p);
                statusListener.accept(details);
                log("MediaFlow presence received: " + details + " | " + state);
            } catch (Exception ex) {
                log("Could not decode MediaFlow presence", ex);
            }
        }

        private static String decodeBase64(String value) {
            return new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8);
        }

        private static boolean allowedOrigin(String origin) {
            if (origin == null || origin.isBlank() || "null".equalsIgnoreCase(origin)) return true;
            String o = origin.toLowerCase(Locale.ROOT);
            return o.equals("https://alexgodly.github.io")
                    || o.startsWith("chrome-extension://")
                    || o.startsWith("edge-extension://")
                    || o.startsWith("http://127.0.0.1")
                    || o.startsWith("http://localhost");
        }

        private static HttpRequest readRequest(InputStream in) throws IOException {
            ByteArrayOutputStream raw = new ByteArrayOutputStream();
            int state = 0;
            while (raw.size() < 16384) {
                int b = in.read();
                if (b < 0) return null;
                raw.write(b);
                if (state == 0 && b == '\r') state = 1;
                else if (state == 1 && b == '\n') state = 2;
                else if (state == 2 && b == '\r') state = 3;
                else if (state == 3 && b == '\n') break;
                else state = 0;
            }

            String text = raw.toString(StandardCharsets.ISO_8859_1);
            String[] lines = text.split("\\r\\n");
            if (lines.length == 0) return null;

            String[] first = lines[0].split(" ");
            if (first.length < 2) return null;
            String method = first[0].trim().toUpperCase(Locale.ROOT);
            String path = first[1].trim();

            Map<String,String> headers = new HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                int c = lines[i].indexOf(':');
                if (c > 0) {
                    headers.put(lines[i].substring(0,c).trim().toLowerCase(Locale.ROOT),
                            lines[i].substring(c+1).trim());
                }
            }

            int length = 0;
            String contentLength = headers.get("content-length");
            if (contentLength != null && !contentLength.isBlank()) {
                try { length = Integer.parseInt(contentLength.trim()); }
                catch (NumberFormatException ex) { throw new IOException("Bad Content-Length"); }
            }
            if (length < 0 || length > 1_048_576) throw new IOException("HTTP body too large");
            byte[] body = length == 0 ? new byte[0] : in.readNBytes(length);
            if (body.length != length) throw new EOFException();

            return new HttpRequest(method, path, headers.get("origin"), headers, body);
        }

        private static String websocketAccept(String key) throws Exception {
            String source = key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
            byte[] digest = MessageDigest.getInstance("SHA-1")
                    .digest(source.getBytes(StandardCharsets.US_ASCII));
            return Base64.getEncoder().encodeToString(digest);
        }

        private static void writeHttpError(OutputStream out, int code, String text, String origin) throws IOException {
            writeHttpResponse(out, code, text, text + "\n", origin, "");
        }

        private static void writeHttpResponse(OutputStream out, int code, String status, String body,
                                              String origin, String extraHeaders) throws IOException {
            byte[] bytes = body == null ? new byte[0] : body.getBytes(StandardCharsets.UTF_8);
            StringBuilder r = new StringBuilder();
            r.append("HTTP/1.1 ").append(code).append(' ').append(status).append("\r\n");
            r.append("Content-Type: text/plain; charset=utf-8\r\n");
            r.append("Cache-Control: no-store\r\n");
            if (origin != null && allowedOrigin(origin)) {
                r.append("Access-Control-Allow-Origin: ").append(origin).append("\r\n");
                r.append("Vary: Origin\r\n");
            }
            if (extraHeaders != null) r.append(extraHeaders);
            r.append("Content-Length: ").append(bytes.length).append("\r\n");
            r.append("Connection: close\r\n\r\n");
            out.write(r.toString().getBytes(StandardCharsets.US_ASCII));
            if (bytes.length > 0) out.write(bytes);
            out.flush();
        }

        private static WsFrame readFrame(InputStream in) throws IOException {
            int b0 = in.read();
            if (b0 < 0) return null;
            int b1 = in.read();
            if (b1 < 0) return null;

            int opcode = b0 & 0x0F;
            boolean masked = (b1 & 0x80) != 0;
            long len = b1 & 0x7F;

            if (len == 126) {
                len = ((long)readByte(in) << 8) | readByte(in);
            } else if (len == 127) {
                len = 0;
                for (int i=0;i<8;i++) len = (len << 8) | readByte(in);
            }

            if (len < 0 || len > 1_048_576) throw new IOException("WebSocket frame too large");

            byte[] mask = null;
            if (masked) {
                mask = in.readNBytes(4);
                if (mask.length != 4) throw new EOFException();
            }

            byte[] payload = in.readNBytes((int)len);
            if (payload.length != (int)len) throw new EOFException();

            if (masked) {
                for (int i=0;i<payload.length;i++) payload[i] ^= mask[i % 4];
            }

            return new WsFrame(opcode, payload);
        }

        private static int readByte(InputStream in) throws IOException {
            int b = in.read();
            if (b < 0) throw new EOFException();
            return b & 0xFF;
        }

        private static void writeFrame(OutputStream out, int opcode, byte[] payload) throws IOException {
            synchronized (out) {
                int len = payload == null ? 0 : payload.length;
                out.write(0x80 | (opcode & 0x0F));
                if (len < 126) {
                    out.write(len);
                } else if (len <= 65535) {
                    out.write(126);
                    out.write((len >>> 8) & 0xFF);
                    out.write(len & 0xFF);
                } else {
                    out.write(127);
                    long value = len;
                    for (int i=7;i>=0;i--) out.write((int)((value >>> (8*i)) & 0xFF));
                }
                if (len > 0) out.write(payload);
                out.flush();
            }
        }

        record HttpRequest(String method, String path, String origin, Map<String,String> headers, byte[] body) {}
        record WsFrame(int opcode, byte[] payload) {}
    }

    // ---------------------------------------------------------------------
    // Discord local IPC client — SET_ACTIVITY only, no OAuth/bot/token.
    // ---------------------------------------------------------------------
    static final class DiscordIpc {
        private volatile boolean running;
        private volatile boolean ready;
        private volatile String clientId = "";
        private volatile Presence presence;
        private volatile RandomAccessFile pipe;
        private Thread loopThread;
        private final Object writeLock = new Object();
        private java.util.function.Consumer<String> statusListener = s -> {};
        private volatile String lastStatus = "Not connected";
        private volatile String lastDiscordMessage = "";
        private volatile String lastError = "";
        private volatile long lastActivitySentAt = 0L;
        private volatile long lastReadyAt = 0L;

        boolean isReady() { return ready; }
        String diagnosticStatus() { return lastStatus; }
        String diagnosticMessage() { return lastDiscordMessage; }
        String diagnosticError() { return lastError; }
        long diagnosticLastActivitySentAt() { return lastActivitySentAt; }
        long diagnosticLastReadyAt() { return lastReadyAt; }
        String diagnosticClientIdMasked() {
            String id = clientId == null ? "" : clientId.trim();
            if (id.length() < 8) return id.isEmpty() ? "(not set)" : id;
            return id.substring(0, 4) + "…" + id.substring(id.length()-4);
        }

        void setStatusListener(java.util.function.Consumer<String> listener) {
            statusListener = listener == null ? s -> {} : listener;
        }

        void setClientId(String value) {
            clientId = value == null ? "" : value.trim();
        }

        void start() {
            if (running) return;
            running = true;
            loopThread = new Thread(this::connectionLoop, "MediaFlow-RPC-Discord");
            loopThread.setDaemon(true);
            loopThread.start();
        }

        void stop() {
            running = false;
            closePipe();
        }

        void reconnect() {
            ready = false;
            closePipe();
        }

        void setPresence(Presence p) {
            presence = p;
            if (ready && p != null) {
                try { sendPresence(p); } catch (Exception ex) { reconnect(); }
            }
        }

        void clearPresence() {
            presence = null;
            if (ready) {
                try { sendActivityJson("null"); } catch (Exception ex) { reconnect(); }
            }
        }

        private void connectionLoop() {
            while (running) {
                if (!validClientId(clientId)) {
                    ready = false;
                    sleep(1500);
                    continue;
                }

                try {
                    lastStatus = "Connecting to Discord";
                    statusListener.accept(lastStatus);
                    log("Connecting to Discord IPC");
                    RandomAccessFile connected = connectPipe();
                    pipe = connected;
                    ready = false;

                    String hello = "{\"v\":1,\"client_id\":\"" + json(clientId) + "\"}";
                    sendFrame(0, hello.getBytes(StandardCharsets.UTF_8));

                    readLoop(connected);
                } catch (Exception ex) {
                    ready = false;
                    lastStatus = "Discord IPC connection failed";
                    lastError = String.valueOf(ex);
                    log("Discord IPC connection failed", ex);
                } finally {
                    closePipe();
                }

                if (running) {
                    lastStatus = "Waiting for Discord";
                    statusListener.accept(lastStatus);
                    sleep(2200);
                }
            }
        }

        private RandomAccessFile connectPipe() throws IOException {
            IOException last = null;
            for (int i=0;i<10;i++) {
                try {
                    return new RandomAccessFile("\\\\.\\pipe\\discord-ipc-" + i, "rw");
                } catch (IOException ex) {
                    last = ex;
                }
            }
            throw last == null ? new IOException("Discord IPC pipe not found") : last;
        }

        private void readLoop(RandomAccessFile raf) throws Exception {
            while (running && raf == pipe) {
                byte[] header = new byte[8];
                raf.readFully(header);
                ByteBuffer hb = ByteBuffer.wrap(header).order(ByteOrder.LITTLE_ENDIAN);
                int opcode = hb.getInt();
                int length = hb.getInt();

                if (length < 0 || length > 4_194_304) throw new IOException("Invalid Discord frame");
                byte[] body = new byte[length];
                raf.readFully(body);

                if (opcode == 3) { // ping
                    sendFrame(4, body);
                    continue;
                }
                if (opcode == 2) throw new IOException("Discord closed IPC");
                if (opcode != 1) continue;

                String msg = new String(body, StandardCharsets.UTF_8);
                lastDiscordMessage = msg.length() > 2000 ? msg.substring(0, 2000) + "…" : msg;

                if (msg.contains("\"READY\"")) {
                    ready = true;
                    lastReadyAt = System.currentTimeMillis();
                    lastStatus = "Discord connected";
                    lastError = "";
                    statusListener.accept(lastStatus);
                    log("Discord IPC READY");
                    Presence p = presence;
                    if (p != null) sendPresence(p);
                }

                if (msg.contains("\"evt\":\"ERROR\"") || msg.contains("\"evt\": \"ERROR\"") || msg.contains("\"code\":4000")) {
                    lastStatus = "Discord RPC error";
                    lastError = lastDiscordMessage;
                    statusListener.accept("Discord RPC error — check diagnostics");
                    log("Discord returned RPC error: " + msg);
                }

                if (msg.contains("\"cmd\":\"SET_ACTIVITY\"") || msg.contains("\"cmd\": \"SET_ACTIVITY\"")) {
                    log("Discord acknowledged SET_ACTIVITY: " + (msg.length() > 1000 ? msg.substring(0,1000) + "…" : msg));
                }
            }
        }

        private void sendPresence(Presence p) throws IOException {
            if (p == null) return;

            String details = discordText(p.details());
            String state = discordText(p.state());

            String activity =
                    "{" +
                    "\"name\":\"MediaFlow\"," +
                    "\"type\":0," +
                    "\"details\":\"" + json(details) + "\"," +
                    "\"state\":\"" + json(state) + "\"," +
                    "\"assets\":{" +
                    "\"large_image\":\"mediaflow\"," +
                    "\"large_text\":\"MediaFlow\"" +
                    "}," +
                    "\"instance\":false" +
                    "}";

            sendActivityJson(activity);
            lastActivitySentAt = System.currentTimeMillis();
            lastStatus = "Presence sent to Discord";
            log("SET_ACTIVITY sent: " + details + " | " + state);
        }

        private void sendActivityJson(String activityJson) throws IOException {
            long pid = ProcessHandle.current().pid();
            String payload =
                    "{" +
                    "\"cmd\":\"SET_ACTIVITY\"," +
                    "\"args\":{" +
                    "\"pid\":" + pid + "," +
                    "\"activity\":" + activityJson +
                    "}," +
                    "\"nonce\":\"" + UUID.randomUUID() + "\"" +
                    "}";
            sendFrame(1, payload.getBytes(StandardCharsets.UTF_8));
        }

        private void sendFrame(int opcode, byte[] payload) throws IOException {
            RandomAccessFile raf = pipe;
            if (raf == null) throw new IOException("Discord not connected");

            ByteBuffer header = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN);
            header.putInt(opcode);
            header.putInt(payload.length);

            synchronized (writeLock) {
                byte[] frame = new byte[8 + payload.length];
                System.arraycopy(header.array(), 0, frame, 0, 8);
                System.arraycopy(payload, 0, frame, 8, payload.length);
                raf.write(frame);
            }
        }

        private void closePipe() {
            RandomAccessFile p = pipe;
            pipe = null;
            ready = false;
            if (p != null) {
                try { p.close(); } catch (IOException ignored) {}
            }
        }

        private static String discordText(String value) {
            String s = value == null ? "" : value.strip();
            if (s.codePointCount(0, s.length()) < 2) s = s + " ";
            int count = s.codePointCount(0, s.length());
            if (count <= 128) return s;
            int end = s.offsetByCodePoints(0, 127);
            return s.substring(0, end) + "…";
        }

        private static String json(String s) {
            if (s == null) return "";
            StringBuilder b = new StringBuilder(s.length() + 16);
            for (int i=0;i<s.length();i++) {
                char c=s.charAt(i);
                switch (c) {
                    case '"' -> b.append("\\\"");
                    case '\\' -> b.append("\\\\");
                    case '\b' -> b.append("\\b");
                    case '\f' -> b.append("\\f");
                    case '\n' -> b.append("\\n");
                    case '\r' -> b.append("\\r");
                    case '\t' -> b.append("\\t");
                    default -> {
                        if (c < 0x20) b.append(String.format("\\u%04x",(int)c));
                        else b.append(c);
                    }
                }
            }
            return b.toString();
        }

        private static void sleep(long ms) {
            try { Thread.sleep(ms); } catch (InterruptedException ignored) {}
        }
    }

    record Presence(String details, String state) {}
}
