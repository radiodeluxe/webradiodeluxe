package org.radiojkhiphop.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Handler;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

/** Owns playback independently of the activity, including audio focus and media controls. */
@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public final class PlaybackService extends MediaSessionService {
    private ExoPlayer player;
    private MediaSession session;

    @Override public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        Handler playbackHandler = new Handler(player.getApplicationLooper());
        player.addListener(new Player.Listener() {
            @Override public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
                if (!playWhenReady) {
                    // A radio pause must discard buffered audio so the next play returns live.
                    playbackHandler.post(() -> {
                        if (player != null && !player.getPlayWhenReady()) {
                            player.stop();
                            player.seekToDefaultPosition();
                        }
                    });
                } else if (player.getPlaybackState() == Player.STATE_IDLE) {
                    // Media controls on the lock screen can resume a stopped live stream.
                    player.prepare();
                }
            }
        });
        PendingIntent activity = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        session = new MediaSession.Builder(this, player).setSessionActivity(activity).build();
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return getPackageName().equals(controllerInfo.getPackageName()) || controllerInfo.isTrusted() ? session : null;
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        if (!player.getPlayWhenReady()) stopSelf();
    }

    @Override public void onDestroy() {
        if (session != null) session.release();
        if (player != null) player.release();
        player = null;
        super.onDestroy();
    }
}
