'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"assets/AssetManifest.bin": "2e3e645876f2e3ca1add5441c4b02130",
"assets/AssetManifest.bin.json": "a13c04b21e071c6cedbf8cc90008419b",
"assets/AssetManifest.json": "9ade85b2d9d4622167624291572b41b1",
"assets/assets/bg1.jpg": "95d8d48b81dac39efc9bba96e5a362e1",
"assets/assets/bg2.jpg": "0bf55a692f6ca76fc75a8f57fb93eeac",
"assets/assets/bg3.jpg": "d34fb64e44b0a84983c05b0146d127fb",
"assets/assets/icon/59.png": "56f2d09475efa8487a76005f26e8182d",
"assets/assets/images/background.jpg": "95d8d48b81dac39efc9bba96e5a362e1",
"assets/assets/images/image1.jpg": "f36764dff280d5cae15e4f5e2790cf06",
"assets/assets/images/image10.jpg": "ab030a3ebc5988d4bbbbd4f4a93edb1c",
"assets/assets/images/image11.jpg": "934ed01ba3963147c901eb71f46d40f1",
"assets/assets/images/image12.jpg": "ea4de29399771c47b5d1b790fc617cc4",
"assets/assets/images/image13.jpg": "041469284eaa1a9d3ec9e731b9c40598",
"assets/assets/images/image14.jpg": "92d2c036068ad5f038b9a0aae698fdf8",
"assets/assets/images/image15.jpg": "c243129b9fd5960eb08da5db79beb219",
"assets/assets/images/image16.jpg": "19ce2ba3c84e9b7be7161ea06d6393b3",
"assets/assets/images/image17.jpg": "eca2f34363167e4e228093f5c886f371",
"assets/assets/images/image2.jpg": "5935626e9ee55fe0ffa45186b38c03e4",
"assets/assets/images/image3.jpg": "14e6b5f4c11c4e69476d90852c7ba228",
"assets/assets/images/image4.jpg": "87b0c7ab53778d772db6da84ce4f3fe0",
"assets/assets/images/image5.jpg": "fc3d28a55d7dcc8e03884f10cab40339",
"assets/assets/images/image6.jpg": "23c9c4d1d8636c6d31ec649a9e64c772",
"assets/assets/images/image7.jpg": "dc2b8c691080deccac92878c5cc4b913",
"assets/assets/images/image8.jpg": "0bf55a692f6ca76fc75a8f57fb93eeac",
"assets/assets/images/image9.jpg": "ab8d9155d4f61bef89632d1ccaf50d58",
"assets/assets/images/medical_bg.jpg": "56f2d09475efa8487a76005f26e8182d",
"assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
"assets/fonts/MaterialIcons-Regular.otf": "c11224810e9661aa9fabb71cdefc1fd8",
"assets/NOTICES": "a9112c5c74c5f7f929f7f5cea62d3b6b",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "33b7d9392238c04c131b6ce224e13711",
"assets/packages/flutter_inappwebview/assets/t_rex_runner/t-rex.css": "5a8d0222407e388155d7d1395a75d5b9",
"assets/packages/flutter_inappwebview/assets/t_rex_runner/t-rex.html": "16911fcc170c8af1c5457940bd0bf055",
"assets/packages/flutter_inappwebview_web/assets/web/web_support.js": "509ae636cfdd93e49b5a6eaf0f06d79f",
"assets/packages/flutter_sound_web/howler/howler.js": "3030c6101d2f8078546711db0d1a24e9",
"assets/packages/flutter_sound_web/src/flutter_sound.js": "7e17a336e64c7aaf2ab0fd4fe1e6cf0f",
"assets/packages/flutter_sound_web/src/flutter_sound_player.js": "b4ab3574b00feb9165fefd08634da145",
"assets/packages/flutter_sound_web/src/flutter_sound_recorder.js": "b37654208f2ab2461a0f66424a20335a",
"assets/packages/flutter_sound_web/src/flutter_sound_stream_processor.js": "d466fda2e806ef7abe69ca33ef278c97",
"assets/packages/record_web/assets/js/record.fixwebmduration.js": "1f0108ea80c8951ba702ced40cf8cdce",
"assets/packages/record_web/assets/js/record.worklet.js": "6d247986689d283b7e45ccdf7214c2ff",
"assets/packages/youtube_player_flutter/assets/speedometer.webp": "50448630e948b5b3998ae5a5d112622b",
"assets/packages/youtube_player_iframe/assets/player.html": "663ba81294a9f52b1afe96815bb6ecf9",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"canvaskit/canvaskit.js": "140ccb7d34d0a55065fbd422b843add6",
"canvaskit/canvaskit.js.symbols": "58832fbed59e00d2190aa295c4d70360",
"canvaskit/canvaskit.wasm": "07b9f5853202304d3b0749d9306573cc",
"canvaskit/chromium/canvaskit.js": "5e27aae346eee469027c80af0751d53d",
"canvaskit/chromium/canvaskit.js.symbols": "193deaca1a1424049326d4a91ad1d88d",
"canvaskit/chromium/canvaskit.wasm": "24c77e750a7fa6d474198905249ff506",
"canvaskit/skwasm.js": "1ef3ea3a0fec4569e5d531da25f34095",
"canvaskit/skwasm.js.symbols": "0088242d10d7e7d6d2649d1fe1bda7c1",
"canvaskit/skwasm.wasm": "264db41426307cfc7fa44b95a7772109",
"canvaskit/skwasm_heavy.js": "413f5b2b2d9345f37de148e2544f584f",
"canvaskit/skwasm_heavy.js.symbols": "3c01ec03b5de6d62c34e17014d1decd3",
"canvaskit/skwasm_heavy.wasm": "8034ad26ba2485dab2fd49bdd786837b",
"favicon.png": "3e75e95986da4d617e80e7f4b6296b65",
"flutter.js": "888483df48293866f9f41d3d9274a779",
"flutter_bootstrap.js": "1d6132bb9b80175cc7473d45424700df",
"icons/Icon-192.png": "3e75e95986da4d617e80e7f4b6296b65",
"icons/Icon-512.png": "3e75e95986da4d617e80e7f4b6296b65",
"icons/Icon-maskable-192.png": "3e75e95986da4d617e80e7f4b6296b65",
"icons/Icon-maskable-512.png": "3e75e95986da4d617e80e7f4b6296b65",
"index.html": "452f682518c381b98358addabaf001b9",
"/": "452f682518c381b98358addabaf001b9",
"main.dart.js": "c3a64609cc806937785a7bae59c82ab4",
"manifest.json": "e5b823edb63935212cb8d8120ebed9ae",
"version.json": "c38d2e50a561036e2cd1997b68d394a6"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
