const uniqid = require("uniqid");
const { compose } = require("ramda");
const { BehaviorSubject } = require("rxjs");
const { toObservable } = require("@ewise/aegisjs-core/frpcore/transforms");
const { requestToAegisOTA, requestToAegisServerWithToken } = require("@ewise/aegisjs-core/hof/requestToAegis");
const { kickstart$: initPollingStream } = require("@ewise/aegisjs-core/hos/pollingCore");
const { safeMakeWebUrl } = require("@ewise/aegisjs-core/fpcore/safeOps");

const DEFAULT_REQUEST_TIMEOUT = 90000; //ms
const DEFAULT_RETY_LIMIT = 5;
const DEFAULT_DELAY_BEFORE_RETRY = 5000; //ms

const HTTP_VERBS = {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    DELETE: "DELETE"
};

const PDV_PATHS = otaUrl => {
    const writeUrl = path => otaUrl ? safeMakeWebUrl(path, otaUrl).getOrElse("") : path;
    return {
        GET_INSTITUTIONS: (instCode = "") => writeUrl(`/ota/institutions/${instCode}`),
        START_OTA: writeUrl("/ota/process"),
        QUERY_OTA: (pid, csrf = "") => writeUrl(`/ota/process/${pid}?challenge=${csrf}`),
        RESUME_OTA: (pid = "") => writeUrl(`/ota/process/${pid}`),
        STOP_OTA: (pid, csrf = "") => writeUrl(`/ota/process/${pid}?challenge=${csrf}`)
    };
};

const requestToAegisSwitch = (method, jwt, xheaders, body, timeout, path) =>
    jwt ? requestToAegisServerWithToken(
        method,                                                 // Method
        jwt,                                                    // JWT
        body,                                                   // Body
        timeout,                                                // Timeout
        path                                                    // Full Url
    ) : requestToAegisOTA(
        method,                                                 // Method
        xheaders,                                               // X-Headers
        body,                                                   // Body
        timeout,                                                // Timeout
        path                                                    // Full Url
    );

const aegis = (options = {}) => {
    const {
        otaUrl: defaultOtaUrl,
        appId: defaultAppId,
        appSecret: defaultAppSecret,
        uname: defaultUname,
        email: defaultEmail,
        jwt: defaultJwt,
        timeout: defaultTimeout = DEFAULT_REQUEST_TIMEOUT,
        retryLimit: defaultRetryLimit = DEFAULT_RETY_LIMIT,
        retryDelay: defaultRetryDelay = DEFAULT_DELAY_BEFORE_RETRY
    } = options;

    return {
        getInstitutions: (args = {}) => {
            const {
                instCode,
                otaUrl = defaultOtaUrl,
                appId = defaultAppId,
                appSecret = defaultAppSecret,
                uname = defaultUname,
                email = defaultEmail,
                jwt = defaultJwt,
                timeout = defaultTimeout
            } = args;

            return requestToAegisSwitch (
                HTTP_VERBS.GET,
                jwt,
                { appId, appSecret, uname, email },
                null,
                timeout,
                PDV_PATHS(otaUrl).GET_INSTITUTIONS(instCode)
            );
        },

        initializeOta: (args = {}) => {
            const {
                instCode,
                prompts,
                otaUrl = defaultOtaUrl,
                appId = defaultAppId,
                appSecret = defaultAppSecret,
                uname = defaultUname,
                email = defaultEmail,
                jwt = defaultJwt,
                timeout = defaultTimeout,
                retryLimit = defaultRetryLimit,
                retryDelay = defaultRetryDelay
            } = args;

            const TERMINAL_PDV_STATES = ["error", "partial", "stopped", "done"];
            const stopStreamCondition = arg => arg ? TERMINAL_PDV_STATES.indexOf(arg.status) === -1 : false;

            const xheaders = { appId, appSecret, uname, email };
            const paths = PDV_PATHS(otaUrl);

            const subject$ = new BehaviorSubject({ processId: null });

            const csrf = uniqid();
            const bodyCsrf = { code: instCode, prompts, challenge: csrf };

            const startAegisOTA = () => requestToAegisSwitch(
                HTTP_VERBS.POST,
                jwt,
                xheaders,
                bodyCsrf,
                timeout,
                PDV_PATHS(otaUrl).START_OTA
            );

            const checkAegisOTA = pid => requestToAegisSwitch(
                HTTP_VERBS.GET,
                jwt,
                xheaders,
                null,
                timeout,
                PDV_PATHS(otaUrl).QUERY_OTA(pid, csrf)
            );

            const initialStream$ = compose(toObservable, startAegisOTA);
            const pollingStream$ = compose(toObservable, checkAegisOTA);
            const createStream = initPollingStream(retryLimit, retryDelay);
            const stream$ = createStream(stopStreamCondition, initialStream$, pollingStream$);

            return {
                run: () =>
                    stream$.subscribe(
                        data => subject$.next(data),
                        err => subject$.error(err),
                        () => subject$.complete()
                    ) && subject$,
                resume: otp =>
                    requestToAegisSwitch(
                        HTTP_VERBS.POST,
                        jwt,
                        xheaders,
                        { ...otp, challenge: csrf },
                        timeout,
                        paths.RESUME_OTA(subject$.getValue().processId)
                    ),
                stop: () =>
                    requestToAegisSwitch(
                        HTTP_VERBS.DELETE,
                        jwt,
                        xheaders,
                        null,
                        timeout,
                        paths.STOP_OTA(subject$.getValue().processId, csrf)
                    )
            };
        }
    };
};

module.exports = (options) =>
    Object.freeze(aegis(options));