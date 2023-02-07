// 这里编写你的代理规则
const proxyMyJS = [
    {
        type: "GET",
        url: "https://httpbin.org",
        urlReplace: ["/1", "/get"],
        contextReplace: [{ search: "args", replace: "genshin" }],
        contextType: "application/javascript",
        paramReplace: [
            { search: "mio_key", replace: "sentry_key" },
        ],
    },
    {
        type: "POST",
        url: "https://httpbin.org",
        urlReplace: ["/2", "/post"],
        contextType: "application/json",
        paramReplace: [
            { search: "mio_key", replace: "sentry_key" },
        ],
    }
]
// 开启Get缓存
const enableCache = true;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': 'Content-Type'
};

addEventListener('fetch', event => {
    event.passThroughOnException();
    event.respondWith(handleRequest(event));
})

// 处理下path
const handlePath = (path) => {
    if (path.substring(path.length - 1, path.length) === '/') {
        return path.substring(0, path.length - 1)
    }
    return path;
}

const handleRequest = async (event) => {
    const { method, url } = event.request
    const pathname = handlePath(new URL(url).pathname)

    // 对于预检请求一律返回200
    if (method === "OPTIONS") {
        return new Response(null, {
            status: 200, headers: {
                ...corsHeaders
            }
        })
    }

    // 循环判断该执行那个
    for (let i = 0; i < proxyMyJS.length; i++) {
        if (proxyMyJS[i].type === method && proxyMyJS[i].urlReplace[0] === pathname) {

            switch (method) {
                case "GET":
                    return getScript(event, proxyMyJS[i])
                case "POST":
                    return postData(event, proxyMyJS[i])
            }
        }
    }
    return new Response(null, { status: 404 })
}

const getScript = async (event, item) => {
    // 缓存功能
    let response = await caches.default.match(event.request);
    if (!response && enableCache) {
        // get 原始地址
        let params = new URL(event.request.url).search;
        console.log(item.url + item.urlReplace[1] + params)
        // 过滤params
        params = handleParamReplace(item, params)
        if (params && params !== '') {
            // 带params的，不缓存
            response = await fetch(item.url + item.urlReplace[1] + params);
        } else {
            response = await fetch(item.url + item.urlReplace[1]);
        }

        let js = await response.text();
        // 过滤body结果
        js = handleContextReplace(item, js);
        //
        response = handleResponse(response, js, item)

        // 不带参数的get就缓存
        if (!params || params === '') {
            event.waitUntil(caches.default.put(event.request, response.clone()));
        }
    }

    return response;
}

const postData = async (event, item) => {
    const request = new Request(event.request);
    request.headers.delete('cookie');
    let params = new URL(event.request.url).search;
    // 过滤params
    params = handleParamReplace(item, params)
    if (params && params !== '') {
        // 带params的，不缓存
        response = await fetch(item.url + item.urlReplace[1] + params, request);
    } else {
        response = await fetch(item.url + item.urlReplace[1], request);
    }
    let js = await response.text();
    // 过滤body结果
    js = handleContextReplace(item, js);
    response = handleResponse(response, js, item)
    return response;
}

const handleContextReplace = (item, context) => {
    let newContext = context;
    // 存在则替换
    if (item?.contextReplace) {
        for (let h = 0; h < item.contextReplace.length; h++) {
            newContext = newContext.replace(item.contextReplace[h].search, item.contextReplace[h].replace);
        }
    }
    return newContext
}
// 处理
const handleParamReplace = (item, params) => {
    let newParams = params
    console.log(item?.paramReplace, newParams)
    if (item?.paramReplace && newParams && newParams !== '') {
        for (let h = 0; h < item.paramReplace.length; h++) {
            console.log(item.paramReplace)
            newParams = newParams.replace(item.paramReplace[h].search, item.paramReplace[h].replace);
        }
    }
    return newParams;
}

const handleResponse = (response, body, item) => {
    // 替换结果
    let resultHeaders = {
        ...response.headers,
        ...corsHeaders,
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Request-Headers'),
    }
    if (item?.contextType) {
        resultHeaders["content-type"] = item.contextType;
    }
    response = new Response(body, {
        headers: resultHeaders
    })
    return response
}