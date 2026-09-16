package com.jc.portal;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private LinearLayout configLayout;
    private EditText ipInput;
    private Button btnConnect;
    private TextView statusText;

    private static final String PREFS_NAME = "jc_portal_prefs";
    private static final String KEY_SERVER_IP = "server_ip";
    private String currentServerIp = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        configLayout = findViewById(R.id.config_layout);
        ipInput = findViewById(R.id.ip_input);
        btnConnect = findViewById(R.id.btn_connect);
        statusText = findViewById(R.id.status_text);

        // Configure WebView settings (Vital for React & Crypto)
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true); // Required for localStorage / Cryptography GCM
        webSettings.setDatabaseEnabled(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW); // Allow local assets loading

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // Load links inside the webview itself
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                // Connection failed (server down or incorrect IP)
                if (request.isForMainFrame()) {
                    showConfigScreen("No se pudo conectar al servidor. Verifique la IP o inicie el servidor Node.js.");
                }
            }
        });

        // Load saved IP settings
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        currentServerIp = prefs.getString(KEY_SERVER_IP, "");

        if (currentServerIp.isEmpty()) {
            showConfigScreen("Configure la IP del servidor Node.js de su computador.");
        } else {
            loadServerUrl(currentServerIp);
        }

        btnConnect.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String ip = ipInput.getText().toString().trim();
                if (ip.isEmpty()) {
                    Toast.makeText(MainActivity.this, "Por favor ingrese una dirección IP válida", Toast.LENGTH_SHORT).show();
                    return;
                }
                
                // Clean IP input format
                ip = ip.replace("http://", "").replace("https://", "").split("/")[0].split(":")[0];
                
                // Save settings
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString(KEY_SERVER_IP, ip);
                editor.apply();
                
                currentServerIp = ip;
                configLayout.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                
                loadServerUrl(ip);
            }
        });
    }

    private void loadServerUrl(String ip) {
        // Port 5000 is our Node production server
        String url = "http://" + ip + ":5000";
        webView.loadUrl(url);
    }

    private void showConfigScreen(String message) {
        webView.setVisibility(View.GONE);
        configLayout.setVisibility(View.VISIBLE);
        statusText.setText(message);
        if (!currentServerIp.isEmpty()) {
            ipInput.setText(currentServerIp);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.getVisibility() == View.VISIBLE && webView.canGoBack()) {
            webView.goBack();
        } else if (webView.getVisibility() == View.VISIBLE) {
            // Show config panel if back pressed on home view
            showConfigScreen("Configuración de Servidor");
        } else {
            super.onBackPressed();
        }
    }
}
