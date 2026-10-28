package org.radiojkhiphop.app;

import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/** Public configuration only. Unknown fields are never used by the application. */
final class AppConfig {
    String name = "JK HipHop", tagline = "O rap em alto nível.", logo = "", background = "";
    String stream = "", instagram = "", facebook = "", tiktok = "", youtube = "", whatsapp = "";
    String email = "", contact = "";
    boolean showPoll = true, showContact = true, pollAvailable;
    boolean tickerEnabled, tickerWhite;
    String tickerText = "";
    final List<Banner> banners = new ArrayList<>();
    JSONObject poll;

    static AppConfig parse(String json) throws JSONException {
        JSONObject root = new JSONObject(json);
        if (!(root.opt("schema_version") instanceof Number) || root.getDouble("schema_version") != 1)
            throw new JSONException("Unsupported app configuration version");
        JSONObject settings = root.getJSONObject("settings");
        JSONObject radio = root.getJSONObject("radio");
        AppConfig c = new AppConfig();
        c.name = text(settings, "radio_name", c.name, 80);
        c.tagline = text(settings, "tagline", c.tagline, 200);
        c.logo = https(settings.optString("logo_url", ""));
        c.background = https(settings.optString("background_url", ""));
        c.showPoll = settings.optBoolean("show_poll", true);
        c.showContact = settings.optBoolean("show_contact", true);
        c.tickerText = text(settings, "ticker_text", "", 300);
        c.tickerEnabled = settings.optBoolean("ticker_enabled", false) && !c.tickerText.isEmpty();
        c.tickerWhite = "white".equals(settings.optString("ticker_text_color", "black"));
        c.stream = https(radio.optString("stream_url", ""));
        c.instagram = https(radio.optString("instagram_url", ""));
        c.facebook = https(radio.optString("facebook_url", ""));
        c.tiktok = https(radio.optString("tiktok_url", ""));
        c.youtube = https(radio.optString("youtube_url", ""));
        c.whatsapp = https(radio.optString("whatsapp_url", ""));
        c.email = text(radio, "contact_email", "", 254);
        c.contact = text(radio, "contact_text", "", 4000);
        c.poll = root.optJSONObject("poll");
        c.pollAvailable = root.optBoolean("poll_available", false);
        JSONArray rows = root.optJSONArray("banners");
        if (rows != null) for (int i = 0; i < Math.min(rows.length(), 100); i++) {
            JSONObject row = rows.optJSONObject(i);
            if (row == null || !row.optBoolean("enabled", true)) continue;
            String image = https(row.optString("image_url", ""));
            String slot = row.optString("slot", "");
            if (image.isEmpty() || !(slot.equals("top") || slot.equals("bottom"))) continue;
            c.banners.add(new Banner(text(row, "id", "", 40), text(row, "title", "Publicidade", 200),
                text(row, "alt_text", "Publicidade", 300), image, https(row.optString("target_url", "")),
                slot, row.optInt("position", 0)));
        }
        c.banners.sort(Comparator.comparingInt(b -> b.position));
        return c;
    }

    List<Banner> slot(String slot) {
        List<Banner> result = new ArrayList<>();
        for (Banner banner : banners) if (banner.slot.equals(slot)) result.add(banner);
        return result;
    }

    static String https(String value) {
        if (value == null || value.length() > 4096 || value.matches(".*[\\x00-\\x20\\x7f].*")) return "";
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null &&
                !uri.getHost().isEmpty() && uri.getUserInfo() == null ? value : "";
        } catch (RuntimeException e) { return ""; }
    }

    static String text(JSONObject row, String key, String fallback, int limit) {
        String value = row.isNull(key) ? fallback : row.optString(key, fallback).trim();
        return value.length() > limit ? value.substring(0, limit) : value;
    }

    static final class Banner {
        final String id, title, alt, image, target, slot;
        final int position;
        Banner(String id, String title, String alt, String image, String target, String slot, int position) {
            this.id = id; this.title = title; this.alt = alt; this.image = image;
            this.target = target; this.slot = slot; this.position = position;
        }
    }
}
