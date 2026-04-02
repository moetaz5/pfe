import 'dart:html' as html;
import 'dart:ui_web' as ui_web;

void registerWebViewFactory(String viewId, String url) {
  ui_web.platformViewRegistry.registerViewFactory(viewId, (int id) {
    return html.IFrameElement()
      ..src = url
      ..style.border = 'none'
      ..style.width = '100%'
      ..style.height = '100%';
  });
}
