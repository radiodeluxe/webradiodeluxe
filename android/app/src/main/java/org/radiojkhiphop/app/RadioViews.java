package org.radiojkhiphop.app;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.os.SystemClock;
import android.view.View;

final class RadioViews {
    private RadioViews() { }

    /** Reproduces the existing public/logo-jk-hiphop.svg as native vector drawing. */
    static final class LogoDrawable extends Drawable {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        @Override public void draw(Canvas canvas) {
            Rect bounds = getBounds();
            float scale = Math.min(bounds.width() / 310f, bounds.height() / 104f);
            canvas.save();
            canvas.translate(bounds.left + (bounds.width() - 310 * scale) / 2, bounds.top + (bounds.height() - 104 * scale) / 2);
            canvas.scale(scale, scale);
            paint.setColor(MainActivity.GOLD); paint.setStyle(Paint.Style.FILL); paint.setShader(null);
            canvas.save(); canvas.translate(12, 8); canvas.skew(-.14054f, 0);
            Path j = new Path();
            j.moveTo(9, 0); j.lineTo(56, 0); j.lineTo(56, 51); j.cubicTo(56, 71, 45, 81, 27, 81);
            j.cubicTo(10, 81, 1, 72, 1, 55); j.lineTo(1, 45); j.lineTo(18, 45); j.lineTo(18, 55);
            j.cubicTo(18, 63, 21, 67, 27, 67); j.cubicTo(33, 67, 38, 63, 38, 54); j.lineTo(38, 16); j.lineTo(9, 16); j.close();
            canvas.drawPath(j, paint);
            Path k = new Path(); k.moveTo(64, 0); k.lineTo(81, 0); k.lineTo(81, 31); k.lineTo(104, 0);
            k.lineTo(125, 0); k.lineTo(96, 38); k.lineTo(126, 79); k.lineTo(104, 79); k.lineTo(81, 46);
            k.lineTo(81, 79); k.lineTo(64, 79); k.close(); canvas.drawPath(k, paint); canvas.restore();
            paint.setColor(MainActivity.WHITE); paint.setTypeface(Typeface.create("sans-serif-black", Typeface.BOLD_ITALIC));
            paint.setTextSize(42); canvas.drawText("HipHop", 141, 60, paint);
            paint.setColor(MainActivity.GOLD); Path line = new Path(); line.moveTo(141, 70); line.lineTo(295, 70);
            line.lineTo(291, 74); line.lineTo(140, 74); line.close(); canvas.drawPath(line, paint);
            paint.setColor(MainActivity.WHITE); paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD)); paint.setTextSize(10);
            float x = 144; for (char letter : "WEB RÁDIO".toCharArray()) { String s = String.valueOf(letter); canvas.drawText(s, x, 91, paint); x += paint.measureText(s) + 4.5f; }
            canvas.restore();
        }
        @Override public int getIntrinsicWidth() { return 310; }
        @Override public int getIntrinsicHeight() { return 104; }
        @Override public void setAlpha(int alpha) { paint.setAlpha(alpha); }
        @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); }
        @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
    }

    static final class PlayButton extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Shader gold = new LinearGradient(-30, -38, 30, 38,
            0xFFFFE57A, 0xFFFFCF00, Shader.TileMode.CLAMP);
        private final Path triangle = new Path();
        private final RectF loadingArc = new RectF(-33, -33, 33, 33);
        private boolean playing, requested, active;
        PlayButton(Context context) {
            super(context); setClickable(true); setFocusable(true);
            triangle.moveTo(-7, -12); triangle.lineTo(13, 0); triangle.lineTo(-7, 12); triangle.close();
        }
        void setPlayback(boolean playing, boolean requested) { this.playing = playing; this.requested = requested; invalidate(); }
        void setActive(boolean active) { this.active = active; invalidate(); }
        @Override public CharSequence getAccessibilityClassName() { return "android.widget.Button"; }
        @Override protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            canvas.save(); canvas.translate(getWidth() / 2f, getHeight() / 2f);
            float scale = Math.min(getWidth(), getHeight()) / 76f;
            canvas.scale(scale, scale);
            paint.setStyle(Paint.Style.FILL); paint.setShader(gold);
            canvas.drawCircle(0, 0, 37, paint);
            paint.setShader(null); paint.setColor(0xFF11130A);
            if (requested) {
                canvas.drawRoundRect(-9, -11, -3, 11, 1.5f, 1.5f, paint);
                canvas.drawRoundRect(3, -11, 9, 11, 1.5f, 1.5f, paint);
            } else canvas.drawPath(triangle, paint);
            if (requested && !playing) {
                paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2); paint.setColor(0x8811130A);
                float angle = ValueAnimator.areAnimatorsEnabled() ? SystemClock.uptimeMillis() % 1200 / 1200f * 360 : 0;
                canvas.drawArc(loadingArc, angle, 90, false, paint);
            }
            if (isFocused()) {
                paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2); paint.setColor(Color.WHITE);
                canvas.drawCircle(0, 0, 34, paint);
            }
            canvas.restore();
            if (requested && !playing && active && ValueAnimator.areAnimatorsEnabled()) postInvalidateDelayed(50);
        }
        @Override public boolean performClick() { return super.performClick(); }
    }

    static final class SocialView extends View {
        private final String kind;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Shader instagramGradient = new LinearGradient(8, 58, 51, 2,
            new int[]{0xFFFFD600, 0xFFFF5A21, 0xFFDA168F, 0xFF7936CE}, null, Shader.TileMode.CLAMP);
        private final Path youtubeTriangle = new Path(), whatsappTail = new Path();
        private final RectF phoneArc = new RectF(22, 21, 40, 38);
        SocialView(Context context) { this(context, "instagram"); }
        SocialView(Context context, String kind) {
            super(context); this.kind = kind; setClickable(true); setFocusable(true);
            youtubeTriangle.moveTo(26, 24); youtubeTriangle.lineTo(37, 30.5f); youtubeTriangle.lineTo(26, 37); youtubeTriangle.close();
            whatsappTail.moveTo(17, 38); whatsappTail.lineTo(14, 47); whatsappTail.lineTo(24, 43);
        }
        @Override protected void onDraw(Canvas canvas) {
            float size = Math.min(getWidth(), getHeight());
            canvas.save(); canvas.translate((getWidth() - size) / 2, (getHeight() - size) / 2); canvas.scale(size / 60f, size / 60f);
            paint.setStyle(Paint.Style.FILL); paint.setShader(null);
            switch (kind) {
                case "instagram": paint.setShader(instagramGradient); break;
                case "facebook": paint.setColor(0xFF087CFA); break;
                case "youtube": paint.setColor(0xFFF00A20); break;
                case "whatsapp": paint.setColor(0xFF09C65A); break;
                default: paint.setColor(0xFF080909);
            }
            canvas.drawCircle(30, 30, 28, paint); paint.setShader(null); paint.setColor(Color.WHITE);
            if (kind.equals("instagram")) {
                paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2.8f); canvas.drawRoundRect(15, 15, 45, 45, 8, 8, paint);
                canvas.drawCircle(30, 30, 7.5f, paint); paint.setStyle(Paint.Style.FILL); canvas.drawCircle(39.5f, 20.5f, 2, paint);
            } else if (kind.equals("facebook")) {
                paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD)); paint.setTextSize(48); canvas.drawText("f", 21, 49, paint);
            } else if (kind.equals("youtube")) {
                canvas.drawRoundRect(13, 19, 47, 42, 7, 7, paint); paint.setColor(0xFFF00A20); canvas.drawPath(youtubeTriangle, paint);
            } else if (kind.equals("whatsapp")) {
                paint.setStyle(Paint.Style.STROKE); paint.setStrokeWidth(2.3f); canvas.drawCircle(30, 29, 15, paint);
                canvas.drawPath(whatsappTail, paint);
                paint.setStrokeWidth(4.5f); paint.setStrokeCap(Paint.Cap.ROUND); canvas.drawArc(phoneArc, 95, 160, false, paint); paint.setStrokeCap(Paint.Cap.BUTT);
            } else {
                paint.setTypeface(Typeface.create("sans-serif", Typeface.BOLD)); paint.setTextSize(42);
                paint.setColor(0xFF1EECD6); canvas.drawText("♪", 14, 43, paint); paint.setColor(0xFFFF2864); canvas.drawText("♪", 18, 45, paint); paint.setColor(Color.WHITE); canvas.drawText("♪", 16, 44, paint);
            }
            canvas.restore();
        }
        @Override public boolean performClick() { return super.performClick(); }
    }
}
