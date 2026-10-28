package org.radiojkhiphop.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ComponentName;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.SeekBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.google.common.util.concurrent.ListenableFuture;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public final class MainActivity extends Activity {
    static final int GOLD = Color.rgb(255, 207, 0), WHITE = Color.rgb(247, 247, 239), MUTED = Color.rgb(177, 179, 173);
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ApiClient api;
    private SharedPreferences preferences;
    private AppConfig config = new AppConfig();
    private MediaController controller;
    private ListenableFuture<MediaController> controllerFuture;
    private boolean foreground, fetching, pendingPlay, hasSavedConfig;
    private String playbackError = "", appliedImage = "", appliedLogo = "";
    private TextView title, subtitle, status, syncStatus;
    private ImageView background, logo;
    private RadioViews.PlayButton play;
    private Button pollShortcut, contactShortcut;
    private SeekBar volume;
    private LinearLayout socials;
    private BannerSlot advertising;

    private final Runnable refresh = new Runnable() {
        @Override public void run() { if (foreground) { fetchConfig(); handler.postDelayed(this, 60000); } }
    };
    private final Runnable rotate = new Runnable() {
        @Override public void run() { if (foreground) { advertising.next(); handler.postDelayed(this, 15000); } }
    };

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        api = new ApiClient(this);
        preferences = getSharedPreferences("jk-radio", MODE_PRIVATE);
        try {
            config = AppConfig.parse(preferences.getString("public-config", ""));
            hasSavedConfig = true;
        } catch (Exception ignored) { }
        createLayout();
        applyConfig();
        connectController();
    }

    private void createLayout() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 9, 9));
        background = new ImageView(this);
        background.setImageResource(org.radiojkhiphop.app.R.drawable.studio);
        background.setScaleType(ImageView.ScaleType.CENTER_CROP);
        background.setAlpha(.18f);
        background.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        root.addView(background, new FrameLayout.LayoutParams(-1, -1));
        View shade = new View(this);
        shade.setBackground(new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
            new int[]{0xDD080909, 0xCC080909, 0xFF080909}));
        root.addView(shade, new FrameLayout.LayoutParams(-1, -1));
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        LinearLayout content = new LinearLayout(this) {
            @Override protected void onMeasure(int widthSpec, int heightSpec) {
                int width = Math.min(MeasureSpec.getSize(widthSpec), dp(440));
                super.onMeasure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY), heightSpec);
            }
        };
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        content.setPadding(dp(18), dp(4), dp(18), dp(12));
        scroll.addView(content, new ScrollView.LayoutParams(-1, -2, Gravity.CENTER_HORIZONTAL));
        root.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        Button menu = iconButton("☰", "Abrir menu");
        menu.setOnClickListener(v -> showMenu());
        header.addView(menu, new LinearLayout.LayoutParams(dp(48), dp(52)));
        logo = new ImageView(this);
        logo.setImageDrawable(new RadioViews.LogoDrawable());
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setContentDescription("JK HipHop — Web Rádio");
        LinearLayout.LayoutParams logoParams = new LinearLayout.LayoutParams(0, dp(48), 1);
        logoParams.setMargins(dp(12), 0, dp(12), 0);
        header.addView(logo, logoParams);
        Button site = iconButton("↗", "Abrir site da rádio");
        site.setOnClickListener(v -> external(ApiClient.ORIGIN));
        header.addView(site, new LinearLayout.LayoutParams(dp(48), dp(52)));
        content.addView(header, new LinearLayout.LayoutParams(-1, dp(60)));
        advertising = new BannerSlot();
        content.addView(advertising, margin(-1, -2, 12, 20));
        View spacer = new View(this);
        content.addView(spacer, new LinearLayout.LayoutParams(1, 0, 1));
        status = text("Conectando à rádio…", 10, GOLD, false);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        content.addView(status, margin(-1, -2, 8, 8));
        title = text("JK HipHop", 24, WHITE, true);
        content.addView(title, margin(-1, -2, 0, 3));
        subtitle = text("O rap em alto nível.", 13, MUTED, false);
        content.addView(subtitle, margin(-1, -2, 0, 0));
        LinearLayout volumeRow = new LinearLayout(this);
        volumeRow.setGravity(Gravity.CENTER_VERTICAL);
        Button quieter = iconButton("−", "Diminuir volume");
        quieter.setOnClickListener(v -> volume.setProgress(Math.max(0, volume.getProgress() - 10)));
        volumeRow.addView(quieter, new LinearLayout.LayoutParams(dp(48), dp(48)));
        volume = new SeekBar(this);
        volume.setContentDescription("Volume da rádio");
        volume.setMax(100);
        volume.setProgress(preferences.getInt("volume", 80));
        volume.setProgressTintList(ColorStateList.valueOf(GOLD));
        volume.setThumbTintList(ColorStateList.valueOf(GOLD));
        volume.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
            @Override public void onProgressChanged(SeekBar bar, int value, boolean fromUser) {
                preferences.edit().putInt("volume", value).apply();
                if (controller != null) controller.setVolume(value / 100f);
            }
            @Override public void onStartTrackingTouch(SeekBar bar) { }
            @Override public void onStopTrackingTouch(SeekBar bar) { }
        });
        volumeRow.addView(volume, new LinearLayout.LayoutParams(0, dp(48), 1));
        Button louder = iconButton("+", "Aumentar volume");
        louder.setOnClickListener(v -> volume.setProgress(Math.min(100, volume.getProgress() + 10)));
        volumeRow.addView(louder, new LinearLayout.LayoutParams(dp(48), dp(48)));
        content.addView(volumeRow, margin(-1, dp(48), 6, 0));
        LinearLayout controls = new LinearLayout(this);
        controls.setGravity(Gravity.CENTER);
        pollShortcut = shortcut("☷", "Enquete");
        pollShortcut.setOnClickListener(v -> showPoll());
        controls.addView(pollShortcut, new LinearLayout.LayoutParams(0, dp(64), 1));
        play = new RadioViews.PlayButton(this);
        play.setOnClickListener(v -> togglePlayback());
        play.setContentDescription("Ouvir rádio");
        controls.addView(play, new LinearLayout.LayoutParams(dp(76), dp(76)));
        contactShortcut = shortcut("✉", "Contato");
        contactShortcut.setOnClickListener(v -> showContact());
        controls.addView(contactShortcut, new LinearLayout.LayoutParams(0, dp(64), 1));
        content.addView(controls, margin(-1, -2, 0, 12));
        socials = new LinearLayout(this);
        socials.setGravity(Gravity.CENTER);
        content.addView(socials, margin(-1, dp(48), 10, 8));
        syncStatus = text("", 10, MUTED, false);
        content.addView(syncStatus, margin(-1, -2, 8, 0));
        setContentView(root);
    }

    private void connectController() {
        SessionToken token = new SessionToken(this, new ComponentName(this, PlaybackService.class));
        controllerFuture = new MediaController.Builder(this, token).buildAsync();
        controllerFuture.addListener(() -> {
            if (isFinishing() || isDestroyed()) return;
            try {
                controller = controllerFuture.get();
                controller.setVolume(volume.getProgress() / 100f);
                controller.addListener(new Player.Listener() {
                    @Override public void onEvents(Player player, Player.Events events) { updatePlayback(); }
                    @Override public void onPlayerError(PlaybackException error) {
                        playbackError = "Não foi possível reproduzir. Toque no play para tentar novamente.";
                        controller.pause();
                        updatePlayback();
                    }
                });
                if (pendingPlay) { pendingPlay = false; togglePlayback(); }
                updatePlayback();
            } catch (Exception e) { playbackError = "Player indisponível. Abra o aplicativo novamente."; updatePlayback(); }
        }, command -> handler.post(command));
    }

    private void togglePlayback() {
        if (controller != null && controller.getPlayWhenReady()) { controller.pause(); return; }
        if (config.stream.isEmpty()) {
            Toast.makeText(this, "Transmissão em configuração. Volte em breve.", Toast.LENGTH_LONG).show();
            return;
        }
        if (controller == null) { pendingPlay = true; status.setText(R.string.preparing_player); return; }
        playbackError = "";
        MediaItem current = controller.getCurrentMediaItem();
        String currentUrl = current == null ? "" : current.mediaId;
        if (!config.stream.equals(currentUrl)) {
            MediaMetadata metadata = new MediaMetadata.Builder().setTitle(config.name).setArtist(config.tagline)
                .setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION).build();
            controller.setMediaItem(new MediaItem.Builder().setMediaId(config.stream).setUri(config.stream).setMediaMetadata(metadata).build());
        }
        if (controller.getPlaybackState() == Player.STATE_IDLE || controller.getPlaybackState() == Player.STATE_ENDED) controller.prepare();
        controller.play();
        updatePlayback();
    }

    private void updatePlayback() {
        boolean playing = controller != null && controller.isPlaying();
        boolean requested = controller != null && controller.getPlayWhenReady();
        play.setPlayback(playing, requested);
        play.setContentDescription(requested ? "Pausar rádio" : "Ouvir rádio");
        if (!playbackError.isEmpty()) status.setText(playbackError);
        else if (playing) status.setText(getString(R.string.live_status, config.name));
        else if (requested && controller.getPlaybackState() == Player.STATE_BUFFERING) status.setText(R.string.connecting_stream);
        else if (config.stream.isEmpty()) status.setText(R.string.stream_not_configured);
        else status.setText(R.string.tap_to_listen);
    }

    private void fetchConfig() {
        if (fetching) return;
        fetching = true;
        api.config((data, error) -> {
            fetching = false;
            if (isDestroyed()) return;
            if (error != null) { syncStatus.setText(hasSavedConfig ? R.string.saved_config_offline : R.string.config_connection_failed); return; }
            try {
                AppConfig fresh = AppConfig.parse(data);
                config = fresh;
                hasSavedConfig = true;
                preferences.edit().putString("public-config", data).apply();
                syncStatus.setText(getString(R.string.radio_footer, config.name));
                applyConfig();
            } catch (Exception e) { syncStatus.setText(R.string.config_unavailable); }
        });
    }

    private void applyConfig() {
        if (controller != null && controller.getCurrentMediaItem() != null) {
            MediaItem current = controller.getCurrentMediaItem();
            String currentStream = current.mediaId;
            if (!config.stream.equals(currentStream)) {
                controller.pause(); controller.stop(); controller.clearMediaItems();
                playbackError = "";
            }
        }
        title.setText(config.name);
        subtitle.setText(config.tagline);
        logo.setContentDescription(config.name + " — Web Rádio");
        if (!appliedLogo.equals(config.logo)) {
            appliedLogo = config.logo;
            logo.setTag(config.logo);
            logo.setImageDrawable(new RadioViews.LogoDrawable());
        }
        if (!config.logo.isEmpty()) api.image(config.logo, logo);
        if (!appliedImage.equals(config.background)) {
            appliedImage = config.background;
            background.setTag(config.background);
            background.setImageResource(org.radiojkhiphop.app.R.drawable.studio);
        }
        if (!config.background.isEmpty()) api.image(config.background, background);
        // Retain all existing campaigns, including the old bottom placement.
        advertising.update(config.banners);
        pollShortcut.setVisibility(config.showPoll ? View.VISIBLE : View.INVISIBLE);
        contactShortcut.setVisibility(config.showContact ? View.VISIBLE : View.INVISIBLE);
        socials.removeAllViews();
        social("instagram", "Instagram", config.instagram);
        social("facebook", "Facebook", config.facebook);
        social("tiktok", "TikTok", config.tiktok);
        social("youtube", "YouTube", config.youtube);
        social("whatsapp", "WhatsApp", config.whatsapp);
        socials.setVisibility(socials.getChildCount() == 0 ? View.GONE : View.VISIBLE);
        updatePlayback();
    }

    private void social(String kind, String label, String url) {
        if (url.isEmpty()) return;
        RadioViews.SocialView button = new RadioViews.SocialView(this, kind);
        button.setContentDescription("Abrir " + label + " da rádio");
        button.setOnClickListener(v -> external(url));
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(dp(48), dp(48));
        params.setMargins(dp(3), 0, dp(3), 0);
        socials.addView(button, params);
    }

    private void showMenu() {
        List<String> labels = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();
        labels.add("Ouvir rádio"); actions.add(this::togglePlayback);
        if (config.showPoll) { labels.add("Enquete"); actions.add(this::showPoll); }
        if (config.showContact) { labels.add("Contato"); actions.add(this::showContact); }
        labels.add("Site da rádio"); actions.add(() -> external(ApiClient.ORIGIN));
        labels.add("Política de privacidade"); actions.add(() -> external(ApiClient.ORIGIN + "/privacidade"));
        new AlertDialog.Builder(this).setTitle(config.name).setItems(labels.toArray(new String[0]),
            (dialog, which) -> actions.get(which).run()).setNegativeButton("Fechar", null).show();
    }

    private void showContact() {
        LinearLayout body = dialogBody();
        TextView copy = text(config.contact.isEmpty() ? "Fale com a rádio pelos canais disponíveis abaixo." : config.contact, 15, WHITE, false);
        copy.setGravity(Gravity.START);
        body.addView(copy, margin(-1, -2, 0, 12));
        if (!config.whatsapp.isEmpty()) {
            Button whatsapp = actionButton("Conversar no WhatsApp");
            whatsapp.setOnClickListener(v -> external(config.whatsapp));
            body.addView(whatsapp, margin(-1, dp(52), 4, 4));
        }
        if (android.util.Patterns.EMAIL_ADDRESS.matcher(config.email).matches()) {
            Button email = actionButton(config.email);
            email.setOnClickListener(v -> {
                try { startActivity(new Intent(Intent.ACTION_SENDTO, Uri.fromParts("mailto", config.email, null))); }
                catch (Exception e) { Toast.makeText(this, "Instale um aplicativo de e-mail para continuar.", Toast.LENGTH_LONG).show(); }
            });
            body.addView(email, margin(-1, dp(52), 4, 4));
        }
        new AlertDialog.Builder(this).setTitle("Contato").setView(body).setPositiveButton("Fechar", null).show();
    }

    private void showPoll() {
        if (!config.pollAvailable) {
            new AlertDialog.Builder(this).setTitle("Enquete").setMessage(R.string.poll_unavailable)
                .setPositiveButton("Fechar", null).show();
            fetchConfig();
            return;
        }
        JSONObject poll = config.poll;
        if (poll == null || poll.optString("id").isEmpty()) {
            new AlertDialog.Builder(this).setTitle("Enquete").setMessage("Nenhuma enquete disponível no momento. Volte em breve.")
                .setPositiveButton("Fechar", null).show(); return;
        }
        LinearLayout body = dialogBody();
        TextView question = text(poll.optString("question", "Enquete da rádio"), 18, WHITE, true);
        question.setGravity(Gravity.START);
        body.addView(question, margin(-1, -2, 0, 16));
        RadioGroup choices = new RadioGroup(this);
        JSONArray options = poll.optJSONArray("options");
        boolean voted = preferences.getBoolean("voted:" + poll.optString("id"), false);
        boolean open = "active".equals(poll.optString("status"));
        if (!poll.isNull("ends_at")) {
            try { open &= java.time.OffsetDateTime.parse(poll.getString("ends_at")).toInstant().isAfter(java.time.Instant.now()); }
            catch (Exception e) { open = false; }
        }
        final boolean votingOpen = open;
        if (options != null) for (int i = 0; i < options.length(); i++) {
            JSONObject option = options.optJSONObject(i);
            if (option == null) continue;
            RadioButton choice = new RadioButton(this);
            choice.setId(View.generateViewId());
            choice.setTag(option.optString("id"));
            String label = option.optString("label");
            if (voted || !open) label += " · " + option.optInt("votes", 0) + " votos";
            choice.setText(label);
            choice.setTextSize(15);
            choice.setMinHeight(dp(52));
            choice.setTextColor(WHITE);
            choice.setButtonTintList(ColorStateList.valueOf(GOLD));
            choice.setEnabled(!voted && votingOpen);
            choices.addView(choice);
        }
        body.addView(choices, new LinearLayout.LayoutParams(-1, -2));
        TextView feedback = text(voted ? "Seu voto já foi registrado. Obrigado por participar!" : votingOpen ? "Escolha uma opção e participe." : "Enquete encerrada.", 13, MUTED, false);
        feedback.setGravity(Gravity.START);
        body.addView(feedback, margin(-1, -2, 12, 8));
        AlertDialog dialog = new AlertDialog.Builder(this).setTitle("Sua voz na rádio").setView(body)
            .setNegativeButton("Fechar", null).setPositiveButton(voted || !votingOpen ? "Atualizar" : "Votar", null).create();
        dialog.setOnShowListener(unused -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            if (voted || !votingOpen) { fetchConfig(); dialog.dismiss(); return; }
            RadioButton selected = choices.findViewById(choices.getCheckedRadioButtonId());
            if (selected == null) { feedback.setText(R.string.choose_poll_option); return; }
            Button submit = dialog.getButton(AlertDialog.BUTTON_POSITIVE);
            submit.setEnabled(false);
            feedback.setText(R.string.registering_vote);
            api.vote(poll.optString("id"), String.valueOf(selected.getTag()), (data, error) -> {
                if (isDestroyed()) return;
                submit.setEnabled(true);
                if (error != null) { feedback.setText(error); return; }
                try {
                    JSONObject response = new JSONObject(data);
                    preferences.edit().putBoolean("voted:" + poll.optString("id"), true).apply();
                    JSONObject results = response.optJSONObject("results");
                    if (results != null) config.poll = results;
                    fetchConfig();
                    dialog.dismiss();
                    Toast.makeText(this, response.optBoolean("already_voted") ? "Você já participou desta enquete." : "Voto registrado. Sua voz faz parte da rádio!", Toast.LENGTH_LONG).show();
                    showPoll();
                } catch (Exception e) { feedback.setText(R.string.vote_confirmation_failed); }
            });
        }));
        dialog.show();
    }

    private void external(String url) {
        if (AppConfig.https(url).isEmpty()) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (Exception e) { Toast.makeText(this, "Não foi possível abrir o link.", Toast.LENGTH_LONG).show(); }
    }

    @Override protected void onResume() {
        super.onResume(); foreground = true; play.setActive(true);
        handler.removeCallbacks(refresh); handler.removeCallbacks(rotate);
        handler.post(refresh); handler.postDelayed(rotate, 15000);
    }
    @Override protected void onPause() {
        foreground = false; play.setActive(false);
        handler.removeCallbacks(refresh); handler.removeCallbacks(rotate);
        super.onPause();
    }
    @Override protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        api.close();
        if (controllerFuture != null) MediaController.releaseFuture(controllerFuture);
        super.onDestroy();
    }

    private LinearLayout dialogBody() {
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(24), dp(12), dp(24), dp(12));
        return body;
    }
    private Button iconButton(String glyph, String description) {
        Button button = new Button(this);
        button.setText(glyph); button.setTextSize(25); button.setTextColor(GOLD);
        button.setBackgroundColor(Color.TRANSPARENT); button.setPadding(0, 0, 0, 0);
        button.setContentDescription(description);
        return button;
    }
    private Button shortcut(String glyph, String label) {
        Button button = iconButton(glyph + "\n" + label, label);
        button.setTextSize(12); button.setAllCaps(false); button.setTextColor(MUTED);
        button.setMinWidth(0); button.setMinimumWidth(0);
        return button;
    }
    private Button actionButton(String label) {
        Button button = new Button(this); button.setText(label); button.setTextColor(Color.BLACK);
        button.setTextSize(13); button.setAllCaps(false); button.setBackground(card(GOLD, GOLD, 10)); return button;
    }
    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(color);
        view.setGravity(Gravity.CENTER); view.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL)); return view;
    }
    private GradientDrawable card(int fill, int stroke, int radius) {
        GradientDrawable drawable = new GradientDrawable(); drawable.setColor(fill); drawable.setCornerRadius(dp(radius)); drawable.setStroke(dp(1), stroke); return drawable;
    }
    private LinearLayout.LayoutParams margin(int width, int height, int before, int after) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(width, height); params.setMargins(0, dp(before), 0, dp(after)); return params;
    }
    int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    private final class BannerSlot extends LinearLayout {
        private final TextView label;
        private final ImageView image;
        private List<AppConfig.Banner> rows = new ArrayList<>();
        private int index;
        BannerSlot() {
            super(MainActivity.this);
            setOrientation(VERTICAL);
            label = text("PUBLICIDADE", 8, MUTED, false); label.setLetterSpacing(.14f);
            label.setGravity(Gravity.START); addView(label, margin(-1, -2, 0, 8));
            image = new ImageView(MainActivity.this) {
                @Override protected void onMeasure(int widthSpec, int heightSpec) {
                    int size = MeasureSpec.getSize(widthSpec);
                    setMeasuredDimension(size, size);
                }
            };
            image.setScaleType(ImageView.ScaleType.FIT_CENTER);
            image.setBackground(card(0xFF101110, 0x44D6B659, 18));
            image.setClipToOutline(true);
            addView(image, new LinearLayout.LayoutParams(-1, -2));
            setVisibility(GONE);
        }
        void update(List<AppConfig.Banner> fresh) {
            String previous = rows.isEmpty() ? "" : rows.get(index % rows.size()).id;
            rows = fresh; index = 0;
            for (int i = 0; i < rows.size(); i++) if (rows.get(i).id.equals(previous)) index = i;
            show();
        }
        void next() { if (rows.size() > 1) { index = (index + 1) % rows.size(); show(); } }
        void show() {
            if (rows.isEmpty()) { image.setTag(""); image.setImageDrawable(null); setVisibility(GONE); return; }
            setVisibility(VISIBLE);
            AppConfig.Banner banner = rows.get(index);
            label.setText(rows.size() > 1 ? getString(R.string.advertising_position, index + 1, rows.size()) : getString(R.string.advertising));
            image.setImageDrawable(null);
            image.setContentDescription(banner.alt.isEmpty() ? banner.title : banner.alt);
            api.image(banner.image, image);
            setClickable(!banner.target.isEmpty());
            setContentDescription("Publicidade: " + banner.title + (banner.target.isEmpty() ? "" : ". Abrir anunciante"));
            setOnClickListener(v -> { if (!banner.target.isEmpty()) external(banner.target); });
        }
    }
}
