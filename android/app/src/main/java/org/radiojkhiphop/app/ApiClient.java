package org.radiojkhiphop.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.LruCache;
import android.widget.ImageView;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

final class ApiClient {
    interface Result { void done(String data, String error); }
    private final ExecutorService executor = Executors.newFixedThreadPool(3);
    private final Handler main = new Handler(Looper.getMainLooper());
    private final SharedPreferences preferences;
    private volatile boolean closed;
    private final LruCache<String, Bitmap> images = new LruCache<String, Bitmap>(12 * 1024) {
        @Override protected int sizeOf(String key, Bitmap bitmap) { return bitmap.getByteCount() / 1024; }
    };
    static final String ORIGIN = "https://webradiodeluxe.vercel.app";
    private static final String API_ORIGIN = apiOrigin();

    ApiClient(Context context) { preferences = context.getSharedPreferences("jk-radio", Context.MODE_PRIVATE); }

    void config(Result result) { request(BuildConfig.API_URL, null, result); }

    void vote(String poll, String option, Result result) {
        try {
            JSONObject body = new JSONObject().put("poll_id", poll).put("option_id", option);
            request(API_ORIGIN + "/api/poll", body.toString(), result);
        } catch (Exception e) { result.done(null, "Escolha uma opção válida."); }
    }

    private void request(String address, String body, Result result) {
        executor.execute(() -> {
            String data = null, error = null;
            HttpURLConnection connection = null;
            try {
                connection = open(address);
                connection.setRequestProperty("Accept", "application/json");
                if (body != null) {
                    connection.setRequestMethod("POST");
                    connection.setRequestProperty("Origin", API_ORIGIN);
                    String cookie = preferences.getString("listener-cookie", "");
                    if (!cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setDoOutput(true);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(body.getBytes(StandardCharsets.UTF_8));
                    }
                }
                int status = connection.getResponseCode();
                if (body != null) persistCookie(connection.getHeaderFields());
                InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
                String text = stream == null ? "" : new String(read(stream, 1024 * 1024), StandardCharsets.UTF_8);
                if (status >= 200 && status < 300) data = text;
                else {
                    try { error = new JSONObject(text).optString("error", "Não foi possível conectar. Tente novamente."); }
                    catch (Exception ignored) { error = "Não foi possível conectar. Tente novamente."; }
                }
            } catch (Exception e) { error = "Sem conexão com a rádio. Tente novamente."; }
            finally { if (connection != null) connection.disconnect(); }
            String finalData = data, finalError = error;
            main.post(() -> { if (!closed) result.done(finalData, finalError); });
        });
    }

    void image(String url, ImageView view) {
        view.setTag(url);
        Bitmap cached = images.get(url);
        if (cached != null) { view.setImageBitmap(cached); return; }
        if (AppConfig.https(url).isEmpty() || url.toLowerCase(Locale.ROOT).split("\\?")[0].endsWith(".svg")) return;
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = open(url);
                if (connection.getResponseCode() != 200) return;
                byte[] data = read(connection.getInputStream(), 6 * 1024 * 1024);
                BitmapFactory.Options bounds = new BitmapFactory.Options();
                bounds.inJustDecodeBounds = true;
                BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
                if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return;
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 1;
                while (bounds.outWidth / options.inSampleSize > 1600 || bounds.outHeight / options.inSampleSize > 2000) options.inSampleSize *= 2;
                Bitmap bitmap = BitmapFactory.decodeByteArray(data, 0, data.length, options);
                if (bitmap == null) return;
                images.put(url, bitmap);
                main.post(() -> { if (!closed && url.equals(view.getTag())) view.setImageBitmap(bitmap); });
            } catch (Exception ignored) { /* The bundled branding remains visible on image failure. */ }
            finally { if (connection != null) connection.disconnect(); }
        });
    }

    private HttpURLConnection open(String address) throws Exception {
        if (AppConfig.https(address).isEmpty() && !localDebugRequest(address)) throw new IllegalArgumentException("HTTPS required");
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(15000);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("User-Agent", "JKHipHop-Android/" + BuildConfig.VERSION_NAME);
        return connection;
    }

    void close() {
        closed = true;
        executor.shutdownNow();
        main.removeCallbacksAndMessages(null);
        images.evictAll();
    }

    private synchronized void persistCookie(Map<String, List<String>> headers) {
        for (Map.Entry<String, List<String>> entry : headers.entrySet()) {
            if (entry.getKey() == null || !entry.getKey().equalsIgnoreCase("Set-Cookie")) continue;
            for (String value : entry.getValue()) {
                String cookie = value.split(";", 2)[0];
                String cookieName = BuildConfig.DEBUG && API_ORIGIN.startsWith("http://") ? "deluxe-listener" : "__Host-deluxe-listener";
                if (cookie.matches(cookieName + "=[a-fA-F0-9-]{36}\\.[a-f0-9]{64}"))
                    preferences.edit().putString("listener-cookie", cookie).apply();
            }
        }
    }

    private static String apiOrigin() {
        if (BuildConfig.DEBUG) {
            try {
                URL api = new URL(BuildConfig.API_URL);
                return api.getProtocol() + "://" + api.getAuthority();
            } catch (Exception ignored) { /* The build validates the debug URL. */ }
        }
        return ORIGIN;
    }

    private static boolean localDebugRequest(String address) {
        if (!BuildConfig.DEBUG || (!address.equals(BuildConfig.API_URL) && !address.equals(API_ORIGIN + "/api/poll"))) return false;
        try {
            URL url = new URL(address);
            return "http".equals(url.getProtocol()) && url.getUserInfo() == null &&
                ("localhost".equals(url.getHost()) || "127.0.0.1".equals(url.getHost()) || "10.0.2.2".equals(url.getHost()));
        } catch (Exception ignored) { return false; }
    }

    private static byte[] read(InputStream stream, int limit) throws Exception {
        try (InputStream input = stream; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (out.size() + count > limit) throw new IllegalArgumentException("Response too large");
                out.write(buffer, 0, count);
            }
            return out.toByteArray();
        }
    }
}
