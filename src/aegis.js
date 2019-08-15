const uniqid = require("uniqid");
const { requestToAegisOTA, requestToAegisServerWithToken } = require("@ewise/aegisjs-core/hof/requestToAegis");
const { addDelay } = require("@ewise/aegisjs-core/frpcore/pointfree");
const { safeMakeWebUrl } = require("@ewise/aegisjs-core/fpcore/safeOps");
const {
    DEFAULT_POLLING_INTERVAL,
    DEFAULT_REQUEST_TIMEOUT,
    DEFAULT_RETY_LIMIT,
    DEFAULT_DELAY_BEFORE_RETRY,
    DEFAULT_AGGREGATE_WITH_TRANSACTIONS
} = require("@ewise/aegisjs-core/constants/standardValues");
const HTTP_VERBS = require("@ewise/aegisjs-core/constants/httpVerbs");
const {
    createRecursivePollStream
} = require("@ewise/aegisjs-core");

const createRecursivePDVPollStream = createRecursivePollStream("error", "partial", "stopped", "done");

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
        retryDelay: defaultRetryDelay = DEFAULT_DELAY_BEFORE_RETRY,
        ajaxTaskFn: defaultAjaxTaskFn = requestToAegisSwitch
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
                timeout = defaultTimeout,
                ajaxTaskFn = defaultAjaxTaskFn
            } = args;

            return ajaxTaskFn(
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
                retryDelay = defaultRetryDelay,
                pollingInterval: pollInterval = DEFAULT_POLLING_INTERVAL,
                withTransactions: transactions = DEFAULT_AGGREGATE_WITH_TRANSACTIONS,
                ajaxTaskFn = defaultAjaxTaskFn
            } = args;

            const xheaders = { appId, appSecret, uname, email };
            const paths = PDV_PATHS(otaUrl);

            const csrf = uniqid();
            const bodyCsrf = { code: instCode, prompts, challenge: csrf, transactions };

/*
            const TERMINAL_PDV_STATES = ["error", "partial", "stopped", "done"];
            const stopStreamCondition = arg => arg ? TERMINAL_PDV_STATES.indexOf(arg.status) === -1 : false;

            const subject$ = new BehaviorSubject({ processId: null });

            const startAegisOTA = ;

            const checkAegisOTA = ;

            const initialStream$ = compose(taskToObservable, startAegisOTA);
            const pollingStream$ = compose(taskToObservable, checkAegisOTA);
            const createStream = initPollingStream(retryLimit, retryDelay);
            const stream$ = createStream(stopStreamCondition, initialStream$, pollingStream$);
*/

            return createRecursivePDVPollStream({
                retryLimit,
                retryDelay,
                start: () => ajaxTaskFn(
                    HTTP_VERBS.POST,
                    jwt,
                    xheaders,
                    bodyCsrf,
                    timeout,
                    PDV_PATHS(otaUrl).START_OTA
                ),
                afterCheck: addDelay(pollInterval),
                check: pid => ajaxTaskFn(
                    HTTP_VERBS.GET,
                    jwt,
                    xheaders,
                    null,
                    timeout,
                    PDV_PATHS(otaUrl).QUERY_OTA(pid, csrf)
                ),
                resume: (getPid, otp) =>
                    ajaxTaskFn(
                        HTTP_VERBS.POST,
                        jwt,
                        xheaders,
                        { ...otp, challenge: csrf },
                        timeout,
                        paths.RESUME_OTA(getPid())
                    ),
                stop: pid =>
                    ajaxTaskFn(
                        HTTP_VERBS.DELETE,
                        jwt,
                        xheaders,
                        null,
                        timeout,
                        paths.STOP_OTA(pid, csrf)
                    )
            
            });

/*
            return {
                run: () =>
                    stream$.subscribe(
                        data => subject$.next(data),
                        err => subject$.error(err),
                        () => subject$.complete(subject$.getValue())
                    ) && subject$,
                };
*/
        }
    };
};

module.exports = (options) =>
    Object.freeze(aegis(options));
