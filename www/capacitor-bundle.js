/*! Capacitor: https://capacitorjs.com/ - MIT License */
var capacitorExports=function(e){"use strict";var t;e.ExceptionCode=void 0,(t=e.ExceptionCode||(e.ExceptionCode={})).Unimplemented="UNIMPLEMENTED",t.Unavailable="UNAVAILABLE";class n extends Error{constructor(e,t,n){super(e),this.message=e,this.code=t,this.data=n}}const s=t=>{const s=t.CapacitorCustomPlatform||null,r=t.Capacitor||{},i=r.Plugins=r.Plugins||{},a=()=>null!==s?s.name:(e=>{var t,n;return(null==e?void 0:e.androidBridge)?"android":(null===(n=null===(t=null==e?void 0:e.webkit)||void 0===t?void 0:t.messageHandlers)||void 0===n?void 0:n.bridge)?"ios":"web"})(t),o=e=>{var t;return null===(t=r.PluginHeaders)||void 0===t?void 0:t.find(t=>t.name===e)},c=new Map;return r.convertFileSrc||(r.convertFileSrc=e=>e),r.getPlatform=a,r.handleError=e=>t.console.error(e),r.isNativePlatform=()=>"web"!==a(),r.isPluginAvailable=e=>{const t=c.get(e);return!!(null==t?void 0:t.platforms.has(a()))||!!o(e)},r.registerPlugin=(t,l={})=>{const d=c.get(t);if(d)return console.warn(`Capacitor plugin "${t}" already registered. Cannot register plugins twice.`),d.proxy;const u=a(),p=o(t);let m;const h=i=>{let a;const o=(...o)=>{const c=(async()=>(!m&&u in l?m=m="function"==typeof l[u]?await l[u]():l[u]:null!==s&&!m&&"web"in l&&(m=m="function"==typeof l.web?await l.web():l.web),m))().then(s=>{const c=((s,i)=>{var a,o;if(!p){if(s)return null===(o=s[i])||void 0===o?void 0:o.bind(s);throw new n(`"${t}" plugin is not implemented on ${u}`,e.ExceptionCode.Unimplemented)}{const e=null==p?void 0:p.methods.find(e=>i===e.name);if(e)return"promise"===e.rtype?e=>r.nativePromise(t,i.toString(),e):(e,n)=>r.nativeCallback(t,i.toString(),e,n);if(s)return null===(a=s[i])||void 0===a?void 0:a.bind(s)}})(s,i);if(c){const e=c(...o);return a=null==e?void 0:e.remove,e}throw new n(`"${t}.${i}()" is not implemented on ${u}`,e.ExceptionCode.Unimplemented)});return"addListener"===i&&(c.remove=async()=>a()),c};return o.toString=()=>`${i.toString()}() { [capacitor code] }`,Object.defineProperty(o,"name",{value:i,writable:!1,configurable:!1}),o},w=h("addListener"),g=h("removeListener"),v=(e,t)=>{const n=w({eventName:e},t),s=async()=>{const s=await n;g({eventName:e,callbackId:s},t)},r=new Promise(e=>n.then(()=>e({remove:s})));return r.remove=async()=>{console.warn("Using addListener() without 'await' is deprecated."),await s()},r},y=new Proxy({},{get(e,t){switch(t){case"$$typeof":return;case"toJSON":return()=>({});case"addListener":return p?v:w;case"removeListener":return g;default:return h(t)}}});return i[t]=y,c.set(t,{name:t,proxy:y,platforms:new Set([...Object.keys(l),...p?[u]:[]])}),y},r.Exception=n,r.DEBUG=!!r.DEBUG,r.isLoggingEnabled=!!r.isLoggingEnabled,r},r=(e=>e.Capacitor=s(e))("undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{}),i=r.registerPlugin;class a{constructor(){this.listeners={},this.retainedEventArguments={},this.windowListeners={}}addListener(e,t){let n=!1;this.listeners[e]||(this.listeners[e]=[],n=!0),this.listeners[e].push(t);const s=this.windowListeners[e];s&&!s.registered&&this.addWindowListener(s),n&&this.sendRetainedArgumentsForEvent(e);return Promise.resolve({remove:async()=>this.removeListener(e,t)})}async removeAllListeners(){this.listeners={};for(const e in this.windowListeners)this.removeWindowListener(this.windowListeners[e]);this.windowListeners={}}notifyListeners(e,t,n){const s=this.listeners[e];if(s)s.forEach(e=>e(t));else if(n){let n=this.retainedEventArguments[e];n||(n=[]),n.push(t),this.retainedEventArguments[e]=n}}hasListeners(e){var t;return!!(null===(t=this.listeners[e])||void 0===t?void 0:t.length)}registerWindowListener(e,t){this.windowListeners[t]={registered:!1,windowEventName:e,pluginEventName:t,handler:e=>{this.notifyListeners(t,e)}}}unimplemented(t="not implemented"){return new r.Exception(t,e.ExceptionCode.Unimplemented)}unavailable(t="not available"){return new r.Exception(t,e.ExceptionCode.Unavailable)}async removeListener(e,t){const n=this.listeners[e];if(!n)return;const s=n.indexOf(t);-1!==s&&this.listeners[e].splice(s,1),this.listeners[e].length||this.removeWindowListener(this.windowListeners[e])}addWindowListener(e){window.addEventListener(e.windowEventName,e.handler),e.registered=!0}removeWindowListener(e){e&&(window.removeEventListener(e.windowEventName,e.handler),e.registered=!1)}sendRetainedArgumentsForEvent(e){const t=this.retainedEventArguments[e];t&&(delete this.retainedEventArguments[e],t.forEach(t=>{this.notifyListeners(e,t)}))}}const o=i("WebView"),c=e=>encodeURIComponent(e).replace(/%(2[346B]|5E|60|7C)/g,decodeURIComponent).replace(/[()]/g,escape),l=e=>e.replace(/(%[\dA-F]{2})+/gi,decodeURIComponent);class d extends a{async getCookies(){const e=document.cookie,t={};return e.split(";").forEach(e=>{if(e.length<=0)return;let[n,s]=e.replace(/=/,"CAP_COOKIE").split("CAP_COOKIE");n=l(n).trim(),s=l(s).trim(),t[n]=s}),t}async setCookie(e){try{const t=c(e.key),n=c(e.value),s=e.expires?`; expires=${e.expires.replace("expires=","")}`:"",r=(e.path||"/").replace("path=",""),i=null!=e.url&&e.url.length>0?`domain=${e.url}`:"";document.cookie=`${t}=${n||""}${s}; path=${r}; ${i};`}catch(e){return Promise.reject(e)}}async deleteCookie(e){try{document.cookie=`${e.key}=; Max-Age=0`}catch(e){return Promise.reject(e)}}async clearCookies(){try{const e=document.cookie.split(";")||[];for(const t of e)document.cookie=t.replace(/^ +/,"").replace(/=.*/,`=;expires=${(new Date).toUTCString()};path=/`)}catch(e){return Promise.reject(e)}}async clearAllCookies(){try{await this.clearCookies()}catch(e){return Promise.reject(e)}}}const u=i("CapacitorCookies",{web:()=>new d}),p=(e,t={})=>{const n=Object.assign({method:e.method||"GET",headers:e.headers},t),s=((e={})=>{const t=Object.keys(e);return Object.keys(e).map(e=>e.toLocaleLowerCase()).reduce((n,s,r)=>(n[s]=e[t[r]],n),{})})(e.headers)["content-type"]||"";if("string"==typeof e.data)n.body=e.data;else if(s.includes("application/x-www-form-urlencoded")){const t=new URLSearchParams;for(const[n,s]of Object.entries(e.data||{}))t.set(n,s);n.body=t.toString()}else if(s.includes("multipart/form-data")||e.data instanceof FormData){const t=new FormData;if(e.data instanceof FormData)e.data.forEach((e,n)=>{t.append(n,e)});else for(const n of Object.keys(e.data))t.append(n,e.data[n]);n.body=t;const s=new Headers(n.headers);s.delete("content-type"),n.headers=s}else(s.includes("application/json")||"object"==typeof e.data)&&(n.body=JSON.stringify(e.data));return n};class m extends a{async request(e){const t=p(e,e.webFetchExtra),n=((e,t=!0)=>e?Object.entries(e).reduce((e,n)=>{const[s,r]=n;let i,a;return Array.isArray(r)?(a="",r.forEach(e=>{i=t?encodeURIComponent(e):e,a+=`${s}=${i}&`}),a.slice(0,-1)):(i=t?encodeURIComponent(r):r,a=`${s}=${i}`),`${e}&${a}`},"").substr(1):null)(e.params,e.shouldEncodeUrlParams),s=n?`${e.url}?${n}`:e.url,r=await fetch(s,t),i=r.headers.get("content-type")||"";let a,o,{responseType:c="text"}=r.ok?e:{};switch(i.includes("application/json")&&(c="json"),c){case"arraybuffer":case"blob":o=await r.blob(),a=await(async e=>new Promise((t,n)=>{const s=new FileReader;s.onload=()=>{const e=s.result;t(e.indexOf(",")>=0?e.split(",")[1]:e)},s.onerror=e=>n(e),s.readAsDataURL(e)}))(o);break;case"json":a=await r.json();break;default:a=await r.text()}const l={};return r.headers.forEach((e,t)=>{l[t]=e}),{data:a,headers:l,status:r.status,url:r.url}}async get(e){return this.request(Object.assign(Object.assign({},e),{method:"GET"}))}async post(e){return this.request(Object.assign(Object.assign({},e),{method:"POST"}))}async put(e){return this.request(Object.assign(Object.assign({},e),{method:"PUT"}))}async patch(e){return this.request(Object.assign(Object.assign({},e),{method:"PATCH"}))}async delete(e){return this.request(Object.assign(Object.assign({},e),{method:"DELETE"}))}}const h=i("CapacitorHttp",{web:()=>new m});var w,g;e.SystemBarsStyle=void 0,(w=e.SystemBarsStyle||(e.SystemBarsStyle={})).Dark="DARK",w.Light="LIGHT",w.Default="DEFAULT",e.SystemBarType=void 0,(g=e.SystemBarType||(e.SystemBarType={})).StatusBar="StatusBar",g.NavigationBar="NavigationBar";class v extends a{async setStyle(){this.unavailable("not available for web")}async setAnimation(){this.unavailable("not available for web")}async show(){this.unavailable("not available for web")}async hide(){this.unavailable("not available for web")}}const y=i("SystemBars",{web:()=>new v});return e.Capacitor=r,e.CapacitorCookies=u,e.CapacitorException=n,e.CapacitorHttp=h,e.SystemBars=y,e.WebPlugin=a,e.WebView=o,e.buildRequestInit=p,e.registerPlugin=i,Object.defineProperty(e,"__esModule",{value:!0}),e}({});
//# sourceMappingURL=capacitor.js.map

(function(t,n){typeof exports=="object"&&typeof module<"u"?n(exports):typeof define=="function"&&define.amd?define(["exports"],n):(t=typeof globalThis<"u"?globalThis:t||self,n(t.outsystemsSynapse={}))})(this,function(t){"use strict";function n(e){e.CapacitorUtils.Synapse=new Proxy({},{get(f,o){return new Proxy({},{get(y,i){return(u,d,r)=>{const a=e.Capacitor.Plugins[o];if(a===void 0){r(new Error(`Capacitor plugin ${o} not found`));return}if(typeof a[i]!="function"){r(new Error(`Method ${i} not found in Capacitor plugin ${o}`));return}(async()=>{try{const s=await a[i](u);d(s)}catch(s){r(s)}})()}}})}})}function p(e){e.CapacitorUtils.Synapse=new Proxy({},{get(f,o){return e.cordova.plugins[o]}})}function c(e=!1){typeof window>"u"||(window.CapacitorUtils=window.CapacitorUtils||{},window.Capacitor!==void 0&&!e?n(window):window.cordova!==void 0&&p(window))}t.exposeSynapse=c,Object.defineProperty(t,Symbol.toStringTag,{value:"Module"})});

var synapse = window.outsystemsSynapse;
var capacitorApp = (function (exports, core) {
    'use strict';

    const App = core.registerPlugin('App', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.AppWeb()),
    });

    class AppWeb extends core.WebPlugin {
        constructor() {
            super();
            this.handleVisibilityChange = () => {
                const data = {
                    isActive: document.hidden !== true,
                };
                this.notifyListeners('appStateChange', data);
                if (document.hidden) {
                    this.notifyListeners('pause', null);
                }
                else {
                    this.notifyListeners('resume', null);
                }
            };
            document.addEventListener('visibilitychange', this.handleVisibilityChange, false);
        }
        exitApp() {
            throw this.unimplemented('Not implemented on web.');
        }
        async getInfo() {
            throw this.unimplemented('Not implemented on web.');
        }
        async getLaunchUrl() {
            return { url: '' };
        }
        async getState() {
            return { isActive: document.hidden !== true };
        }
        async minimizeApp() {
            throw this.unimplemented('Not implemented on web.');
        }
        async toggleBackButtonHandler() {
            throw this.unimplemented('Not implemented on web.');
        }
        async getAppLanguage() {
            return {
                value: navigator.language.split('-')[0].toLowerCase(),
            };
        }
    }

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        AppWeb: AppWeb
    });

    exports.App = App;

    return exports;

})({}, capacitorExports);

var capacitorBrowser = (function (exports, core) {
    'use strict';

    const Browser = core.registerPlugin('Browser', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.BrowserWeb()),
    });

    class BrowserWeb extends core.WebPlugin {
        constructor() {
            super();
            this._lastWindow = null;
        }
        async open(options) {
            this._lastWindow = window.open(options.url, options.windowName || '_blank');
        }
        async close() {
            return new Promise((resolve, reject) => {
                if (this._lastWindow != null) {
                    this._lastWindow.close();
                    this._lastWindow = null;
                    resolve();
                }
                else {
                    reject('No active window to close!');
                }
            });
        }
    }
    new BrowserWeb();

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        BrowserWeb: BrowserWeb
    });

    exports.Browser = Browser;

    return exports;

})({}, capacitorExports);

var capacitorFilesystemPluginCapacitor = (function (exports, core, synapse) {
    'use strict';

    exports.Directory = void 0;
    (function (Directory) {
        /**
         * The Documents directory.
         * On iOS it's the app's documents directory.
         * Use this directory to store user-generated content.
         * On Android it's the Public Documents folder, so it's accessible from other apps.
         * It's not accessible on Android 10 unless the app enables legacy External Storage
         * by adding `android:requestLegacyExternalStorage="true"` in the `application` tag
         * in the `AndroidManifest.xml`.
         * On Android 11 or newer the app can only access the files/folders the app created.
         *
         * @since 1.0.0
         */
        Directory["Documents"] = "DOCUMENTS";
        /**
         * The Data directory.
         * On iOS it will use the Documents directory.
         * On Android it's the directory holding application files.
         * Files will be deleted when the application is uninstalled.
         *
         * @since 1.0.0
         */
        Directory["Data"] = "DATA";
        /**
         * The Library directory.
         * On iOS it will use the Library directory.
         * On Android it's the directory holding application files.
         * Files will be deleted when the application is uninstalled.
         *
         * @since 1.1.0
         */
        Directory["Library"] = "LIBRARY";
        /**
         * The Cache directory.
         * Can be deleted in cases of low memory, so use this directory to write app-specific files.
         * that your app can re-create easily.
         *
         * @since 1.0.0
         */
        Directory["Cache"] = "CACHE";
        /**
         * The external directory.
         * On iOS it will use the Documents directory.
         * On Android it's the directory on the primary shared/external
         * storage device where the application can place persistent files it owns.
         * These files are internal to the applications, and not typically visible
         * to the user as media.
         * Files will be deleted when the application is uninstalled.
         *
         * @since 1.0.0
         */
        Directory["External"] = "EXTERNAL";
        /**
         * The external storage directory.
         * On iOS it will use the Documents directory.
         * On Android it's the primary shared/external storage directory.
         * It's not accessible on Android 10 unless the app enables legacy External Storage
         * by adding `android:requestLegacyExternalStorage="true"` in the `application` tag
         * in the `AndroidManifest.xml`.
         * It's not accessible on Android 11 or newer.
         *
         * @since 1.0.0
         */
        Directory["ExternalStorage"] = "EXTERNAL_STORAGE";
        /**
         * The external cache directory.
         * On iOS it will use the Documents directory.
         * On Android it's the primary shared/external cache.
         *
         * @since 7.1.0
         */
        Directory["ExternalCache"] = "EXTERNAL_CACHE";
        /**
         * The Library directory without cloud backup. Used in iOS.
         * On Android it's the directory holding application files.
         *
         * @since 7.1.0
         */
        Directory["LibraryNoCloud"] = "LIBRARY_NO_CLOUD";
        /**
         * A temporary directory for iOS.
         * On Android it's the directory holding the application cache.
         *
         * @since 7.1.0
         */
        Directory["Temporary"] = "TEMPORARY";
    })(exports.Directory || (exports.Directory = {}));
    exports.Encoding = void 0;
    (function (Encoding) {
        /**
         * Eight-bit UCS Transformation Format
         *
         * @since 1.0.0
         */
        Encoding["UTF8"] = "utf8";
        /**
         * Seven-bit ASCII, a.k.a. ISO646-US, a.k.a. the Basic Latin block of the
         * Unicode character set
         * This encoding is only supported on Android.
         *
         * @since 1.0.0
         */
        Encoding["ASCII"] = "ascii";
        /**
         * Sixteen-bit UCS Transformation Format, byte order identified by an
         * optional byte-order mark
         * This encoding is only supported on Android.
         *
         * @since 1.0.0
         */
        Encoding["UTF16"] = "utf16";
    })(exports.Encoding || (exports.Encoding = {}));
    /**
     * @deprecated Use `Directory`.
     * @since 1.0.0
     */
    const FilesystemDirectory = exports.Directory;
    /**
     * @deprecated Use `Encoding`.
     * @since 1.0.0
     */
    const FilesystemEncoding = exports.Encoding;

    const Filesystem = core.registerPlugin('Filesystem', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.FilesystemWeb()),
    });
    synapse.exposeSynapse();

    function resolve(path) {
        const posix = path.split('/').filter((item) => item !== '.');
        const newPosix = [];
        posix.forEach((item) => {
            if (item === '..' && newPosix.length > 0 && newPosix[newPosix.length - 1] !== '..') {
                newPosix.pop();
            }
            else {
                newPosix.push(item);
            }
        });
        return newPosix.join('/');
    }
    function isPathParent(parent, children) {
        parent = resolve(parent);
        children = resolve(children);
        const pathsA = parent.split('/');
        const pathsB = children.split('/');
        return parent !== children && pathsA.every((value, index) => value === pathsB[index]);
    }
    class FilesystemWeb extends core.WebPlugin {
        constructor() {
            super(...arguments);
            this.DB_VERSION = 1;
            this.DB_NAME = 'Disc';
            this._writeCmds = ['add', 'put', 'delete'];
            /**
             * Function that performs a http request to a server and downloads the file to the specified destination
             *
             * @deprecated Use the @capacitor/file-transfer plugin instead.
             * @param options the options for the download operation
             * @returns a promise that resolves with the download file result
             */
            this.downloadFile = async (options) => {
                var _a, _b;
                const requestInit = core.buildRequestInit(options, options.webFetchExtra);
                const response = await fetch(options.url, requestInit);
                let blob;
                if (!options.progress)
                    blob = await response.blob();
                else if (!(response === null || response === void 0 ? void 0 : response.body))
                    blob = new Blob();
                else {
                    const reader = response.body.getReader();
                    let bytes = 0;
                    const chunks = [];
                    const contentType = response.headers.get('content-type');
                    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        chunks.push(value);
                        bytes += (value === null || value === void 0 ? void 0 : value.length) || 0;
                        const status = {
                            url: options.url,
                            bytes,
                            contentLength,
                        };
                        this.notifyListeners('progress', status);
                    }
                    const allChunks = new Uint8Array(bytes);
                    let position = 0;
                    for (const chunk of chunks) {
                        if (typeof chunk === 'undefined')
                            continue;
                        allChunks.set(chunk, position);
                        position += chunk.length;
                    }
                    blob = new Blob([allChunks.buffer], { type: contentType || undefined });
                }
                const result = await this.writeFile({
                    path: options.path,
                    directory: (_a = options.directory) !== null && _a !== void 0 ? _a : undefined,
                    recursive: (_b = options.recursive) !== null && _b !== void 0 ? _b : false,
                    data: blob,
                });
                return { path: result.uri, blob };
            };
        }
        readFileInChunks(_options, _callback) {
            throw this.unavailable('Method not implemented.');
        }
        async initDb() {
            if (this._db !== undefined) {
                return this._db;
            }
            if (!('indexedDB' in window)) {
                throw this.unavailable("This browser doesn't support IndexedDB");
            }
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
                request.onupgradeneeded = FilesystemWeb.doUpgrade;
                request.onsuccess = () => {
                    this._db = request.result;
                    resolve(request.result);
                };
                request.onerror = () => reject(request.error);
                request.onblocked = () => {
                    console.warn('db blocked');
                };
            });
        }
        static doUpgrade(event) {
            const eventTarget = event.target;
            const db = eventTarget.result;
            switch (event.oldVersion) {
                case 0:
                case 1:
                default: {
                    if (db.objectStoreNames.contains('FileStorage')) {
                        db.deleteObjectStore('FileStorage');
                    }
                    const store = db.createObjectStore('FileStorage', { keyPath: 'path' });
                    store.createIndex('by_folder', 'folder');
                }
            }
        }
        async dbRequest(cmd, args) {
            const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? 'readwrite' : 'readonly';
            return this.initDb().then((conn) => {
                return new Promise((resolve, reject) => {
                    const tx = conn.transaction(['FileStorage'], readFlag);
                    const store = tx.objectStore('FileStorage');
                    const req = store[cmd](...args);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            });
        }
        async dbIndexRequest(indexName, cmd, args) {
            const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? 'readwrite' : 'readonly';
            return this.initDb().then((conn) => {
                return new Promise((resolve, reject) => {
                    const tx = conn.transaction(['FileStorage'], readFlag);
                    const store = tx.objectStore('FileStorage');
                    const index = store.index(indexName);
                    const req = index[cmd](...args);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                });
            });
        }
        getPath(directory, uriPath) {
            const cleanedUriPath = uriPath !== undefined ? uriPath.replace(/^[/]+|[/]+$/g, '') : '';
            let fsPath = '';
            if (directory !== undefined)
                fsPath += '/' + directory;
            if (uriPath !== '')
                fsPath += '/' + cleanedUriPath;
            return fsPath;
        }
        async clear() {
            const conn = await this.initDb();
            const tx = conn.transaction(['FileStorage'], 'readwrite');
            const store = tx.objectStore('FileStorage');
            store.clear();
        }
        /**
         * Read a file from disk
         * @param options options for the file read
         * @return a promise that resolves with the read file data result
         */
        async readFile(options) {
            const path = this.getPath(options.directory, options.path);
            // const encoding = options.encoding;
            const entry = (await this.dbRequest('get', [path]));
            if (entry === undefined)
                throw Error('File does not exist.');
            return { data: entry.content ? entry.content : '' };
        }
        /**
         * Write a file to disk in the specified location on device
         * @param options options for the file write
         * @return a promise that resolves with the file write result
         */
        async writeFile(options) {
            const path = this.getPath(options.directory, options.path);
            let data = options.data;
            const encoding = options.encoding;
            const doRecursive = options.recursive;
            const occupiedEntry = (await this.dbRequest('get', [path]));
            if (occupiedEntry && occupiedEntry.type === 'directory')
                throw Error('The supplied path is a directory.');
            const parentPath = path.substr(0, path.lastIndexOf('/'));
            const parentEntry = (await this.dbRequest('get', [parentPath]));
            if (parentEntry === undefined) {
                const subDirIndex = parentPath.indexOf('/', 1);
                if (subDirIndex !== -1) {
                    const parentArgPath = parentPath.substr(subDirIndex);
                    await this.mkdir({
                        path: parentArgPath,
                        directory: options.directory,
                        recursive: doRecursive,
                    });
                }
            }
            if (!encoding && !(data instanceof Blob)) {
                data = data.indexOf(',') >= 0 ? data.split(',')[1] : data;
                if (!this.isBase64String(data))
                    throw Error('The supplied data is not valid base64 content.');
            }
            const now = Date.now();
            const pathObj = {
                path: path,
                folder: parentPath,
                type: 'file',
                size: data instanceof Blob ? data.size : data.length,
                ctime: now,
                mtime: now,
                content: data,
            };
            await this.dbRequest('put', [pathObj]);
            return {
                uri: pathObj.path,
            };
        }
        /**
         * Append to a file on disk in the specified location on device
         * @param options options for the file append
         * @return a promise that resolves with the file write result
         */
        async appendFile(options) {
            const path = this.getPath(options.directory, options.path);
            let data = options.data;
            const encoding = options.encoding;
            const parentPath = path.substr(0, path.lastIndexOf('/'));
            const now = Date.now();
            let ctime = now;
            const occupiedEntry = (await this.dbRequest('get', [path]));
            if (occupiedEntry && occupiedEntry.type === 'directory')
                throw Error('The supplied path is a directory.');
            const parentEntry = (await this.dbRequest('get', [parentPath]));
            if (parentEntry === undefined) {
                const subDirIndex = parentPath.indexOf('/', 1);
                if (subDirIndex !== -1) {
                    const parentArgPath = parentPath.substr(subDirIndex);
                    await this.mkdir({
                        path: parentArgPath,
                        directory: options.directory,
                        recursive: true,
                    });
                }
            }
            if (!encoding && !this.isBase64String(data))
                throw Error('The supplied data is not valid base64 content.');
            if (occupiedEntry !== undefined) {
                if (occupiedEntry.content instanceof Blob) {
                    throw Error('The occupied entry contains a Blob object which cannot be appended to.');
                }
                if (occupiedEntry.content !== undefined && !encoding) {
                    data = btoa(atob(occupiedEntry.content) + atob(data));
                }
                else {
                    data = occupiedEntry.content + data;
                }
                ctime = occupiedEntry.ctime;
            }
            const pathObj = {
                path: path,
                folder: parentPath,
                type: 'file',
                size: data.length,
                ctime: ctime,
                mtime: now,
                content: data,
            };
            await this.dbRequest('put', [pathObj]);
        }
        /**
         * Delete a file from disk
         * @param options options for the file delete
         * @return a promise that resolves with the deleted file data result
         */
        async deleteFile(options) {
            const path = this.getPath(options.directory, options.path);
            const entry = (await this.dbRequest('get', [path]));
            if (entry === undefined)
                throw Error('File does not exist.');
            const entries = await this.dbIndexRequest('by_folder', 'getAllKeys', [IDBKeyRange.only(path)]);
            if (entries.length !== 0)
                throw Error('Folder is not empty.');
            await this.dbRequest('delete', [path]);
        }
        /**
         * Create a directory.
         * @param options options for the mkdir
         * @return a promise that resolves with the mkdir result
         */
        async mkdir(options) {
            const path = this.getPath(options.directory, options.path);
            const doRecursive = options.recursive;
            const parentPath = path.substr(0, path.lastIndexOf('/'));
            const depth = (path.match(/\//g) || []).length;
            const parentEntry = (await this.dbRequest('get', [parentPath]));
            const occupiedEntry = (await this.dbRequest('get', [path]));
            if (depth === 1)
                throw Error('Cannot create Root directory');
            if (occupiedEntry !== undefined)
                throw Error('Current directory does already exist.');
            if (!doRecursive && depth !== 2 && parentEntry === undefined)
                throw Error('Parent directory must exist');
            if (doRecursive && depth !== 2 && parentEntry === undefined) {
                const parentArgPath = parentPath.substr(parentPath.indexOf('/', 1));
                await this.mkdir({
                    path: parentArgPath,
                    directory: options.directory,
                    recursive: doRecursive,
                });
            }
            const now = Date.now();
            const pathObj = {
                path: path,
                folder: parentPath,
                type: 'directory',
                size: 0,
                ctime: now,
                mtime: now,
            };
            await this.dbRequest('put', [pathObj]);
        }
        /**
         * Remove a directory
         * @param options the options for the directory remove
         */
        async rmdir(options) {
            const { path, directory, recursive } = options;
            const fullPath = this.getPath(directory, path);
            const entry = (await this.dbRequest('get', [fullPath]));
            if (entry === undefined)
                throw Error('Folder does not exist.');
            if (entry.type !== 'directory')
                throw Error('Requested path is not a directory');
            const readDirResult = await this.readdir({ path, directory });
            if (readDirResult.files.length !== 0 && !recursive)
                throw Error('Folder is not empty');
            for (const entry of readDirResult.files) {
                const entryPath = `${path}/${entry.name}`;
                const entryObj = await this.stat({ path: entryPath, directory });
                if (entryObj.type === 'file') {
                    await this.deleteFile({ path: entryPath, directory });
                }
                else {
                    await this.rmdir({ path: entryPath, directory, recursive });
                }
            }
            await this.dbRequest('delete', [fullPath]);
        }
        /**
         * Return a list of files from the directory (not recursive)
         * @param options the options for the readdir operation
         * @return a promise that resolves with the readdir directory listing result
         */
        async readdir(options) {
            const path = this.getPath(options.directory, options.path);
            const entry = (await this.dbRequest('get', [path]));
            if (options.path !== '' && entry === undefined)
                throw Error('Folder does not exist.');
            const entries = await this.dbIndexRequest('by_folder', 'getAllKeys', [IDBKeyRange.only(path)]);
            const files = await Promise.all(entries.map(async (e) => {
                let subEntry = (await this.dbRequest('get', [e]));
                if (subEntry === undefined) {
                    subEntry = (await this.dbRequest('get', [e + '/']));
                }
                return {
                    name: e.substring(path.length + 1),
                    type: subEntry.type,
                    size: subEntry.size,
                    ctime: subEntry.ctime,
                    mtime: subEntry.mtime,
                    uri: subEntry.path,
                };
            }));
            return { files: files };
        }
        /**
         * Return full File URI for a path and directory
         * @param options the options for the stat operation
         * @return a promise that resolves with the file stat result
         */
        async getUri(options) {
            const path = this.getPath(options.directory, options.path);
            let entry = (await this.dbRequest('get', [path]));
            if (entry === undefined) {
                entry = (await this.dbRequest('get', [path + '/']));
            }
            return {
                uri: (entry === null || entry === void 0 ? void 0 : entry.path) || path,
            };
        }
        /**
         * Return data about a file
         * @param options the options for the stat operation
         * @return a promise that resolves with the file stat result
         */
        async stat(options) {
            const path = this.getPath(options.directory, options.path);
            let entry = (await this.dbRequest('get', [path]));
            if (entry === undefined) {
                entry = (await this.dbRequest('get', [path + '/']));
            }
            if (entry === undefined)
                throw Error('Entry does not exist.');
            return {
                name: entry.path.substring(path.length + 1),
                type: entry.type,
                size: entry.size,
                ctime: entry.ctime,
                mtime: entry.mtime,
                uri: entry.path,
            };
        }
        /**
         * Rename a file or directory
         * @param options the options for the rename operation
         * @return a promise that resolves with the rename result
         */
        async rename(options) {
            await this._copy(options, true);
            return;
        }
        /**
         * Copy a file or directory
         * @param options the options for the copy operation
         * @return a promise that resolves with the copy result
         */
        async copy(options) {
            return this._copy(options, false);
        }
        async requestPermissions() {
            return { publicStorage: 'granted' };
        }
        async checkPermissions() {
            return { publicStorage: 'granted' };
        }
        /**
         * Function that can perform a copy or a rename
         * @param options the options for the rename operation
         * @param doRename whether to perform a rename or copy operation
         * @return a promise that resolves with the result
         */
        async _copy(options, doRename = false) {
            let { toDirectory } = options;
            const { to, from, directory: fromDirectory } = options;
            if (!to || !from) {
                throw Error('Both to and from must be provided');
            }
            // If no "to" directory is provided, use the "from" directory
            if (!toDirectory) {
                toDirectory = fromDirectory;
            }
            const fromPath = this.getPath(fromDirectory, from);
            const toPath = this.getPath(toDirectory, to);
            // Test that the "to" and "from" locations are different
            if (fromPath === toPath) {
                return {
                    uri: toPath,
                };
            }
            if (isPathParent(fromPath, toPath)) {
                throw Error('To path cannot contain the from path');
            }
            // Check the state of the "to" location
            let toObj;
            try {
                toObj = await this.stat({
                    path: to,
                    directory: toDirectory,
                });
            }
            catch (e) {
                // To location does not exist, ensure the directory containing "to" location exists and is a directory
                const toPathComponents = to.split('/');
                toPathComponents.pop();
                const toPath = toPathComponents.join('/');
                // Check the containing directory of the "to" location exists
                if (toPathComponents.length > 0) {
                    const toParentDirectory = await this.stat({
                        path: toPath,
                        directory: toDirectory,
                    });
                    if (toParentDirectory.type !== 'directory') {
                        throw new Error('Parent directory of the to path is a file');
                    }
                }
            }
            // Cannot overwrite a directory
            if (toObj && toObj.type === 'directory') {
                throw new Error('Cannot overwrite a directory with a file');
            }
            // Ensure the "from" object exists
            const fromObj = await this.stat({
                path: from,
                directory: fromDirectory,
            });
            // Set the mtime/ctime of the supplied path
            const updateTime = async (path, ctime, mtime) => {
                const fullPath = this.getPath(toDirectory, path);
                const entry = (await this.dbRequest('get', [fullPath]));
                entry.ctime = ctime;
                entry.mtime = mtime;
                await this.dbRequest('put', [entry]);
            };
            const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
            switch (fromObj.type) {
                // The "from" object is a file
                case 'file': {
                    // Read the file
                    const file = await this.readFile({
                        path: from,
                        directory: fromDirectory,
                    });
                    // Optionally remove the file
                    if (doRename) {
                        await this.deleteFile({
                            path: from,
                            directory: fromDirectory,
                        });
                    }
                    let encoding;
                    if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
                        encoding = exports.Encoding.UTF8;
                    }
                    // Write the file to the new location
                    const writeResult = await this.writeFile({
                        path: to,
                        directory: toDirectory,
                        data: file.data,
                        encoding: encoding,
                    });
                    // Copy the mtime/ctime of a renamed file
                    if (doRename) {
                        await updateTime(to, ctime, fromObj.mtime);
                    }
                    // Resolve promise
                    return writeResult;
                }
                case 'directory': {
                    if (toObj) {
                        throw Error('Cannot move a directory over an existing object');
                    }
                    try {
                        // Create the to directory
                        await this.mkdir({
                            path: to,
                            directory: toDirectory,
                            recursive: false,
                        });
                        // Copy the mtime/ctime of a renamed directory
                        if (doRename) {
                            await updateTime(to, ctime, fromObj.mtime);
                        }
                    }
                    catch (e) {
                        // ignore
                    }
                    // Iterate over the contents of the from location
                    const contents = (await this.readdir({
                        path: from,
                        directory: fromDirectory,
                    })).files;
                    for (const filename of contents) {
                        // Move item from the from directory to the to directory
                        await this._copy({
                            from: `${from}/${filename.name}`,
                            to: `${to}/${filename.name}`,
                            directory: fromDirectory,
                            toDirectory,
                        }, doRename);
                    }
                    // Optionally remove the original from directory
                    if (doRename) {
                        await this.rmdir({
                            path: from,
                            directory: fromDirectory,
                        });
                    }
                }
            }
            return {
                uri: toPath,
            };
        }
        isBase64String(str) {
            try {
                return btoa(atob(str)) == str;
            }
            catch (err) {
                return false;
            }
        }
    }
    FilesystemWeb._debug = true;

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        FilesystemWeb: FilesystemWeb
    });

    exports.Filesystem = Filesystem;
    exports.FilesystemDirectory = FilesystemDirectory;
    exports.FilesystemEncoding = FilesystemEncoding;

    return exports;

})({}, capacitorExports, synapse);

var capacitorShare = (function (exports, core) {
    'use strict';

    const Share = core.registerPlugin('Share', {
        web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.ShareWeb()),
    });

    class ShareWeb extends core.WebPlugin {
        async canShare() {
            if (typeof navigator === 'undefined' || !navigator.share) {
                return { value: false };
            }
            else {
                return { value: true };
            }
        }
        async share(options) {
            if (typeof navigator === 'undefined' || !navigator.share) {
                throw this.unavailable('Share API not available in this browser');
            }
            await navigator.share({
                title: options.title,
                text: options.text,
                url: options.url,
            });
            return {};
        }
    }

    var web = /*#__PURE__*/Object.freeze({
        __proto__: null,
        ShareWeb: ShareWeb
    });

    exports.Share = Share;

    return exports;

})({}, capacitorExports);

var capacitorFileOpener = (function (exports, core) {
	'use strict';

	const FileOpener = core.registerPlugin('FileOpener');

	exports.FileOpener = FileOpener;

	return exports;

})({}, capacitorExports);

