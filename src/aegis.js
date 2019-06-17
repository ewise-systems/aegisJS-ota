const uniqid = require("uniqid");
const { compose } = require("ramda");
const { BehaviorSubject } = require("rxjs");
const { toObservable } = require("@ewise/aegisjs-core/frpcore/transforms");
const { requestToAegisOTA } = require("@ewise/aegisjs-core/hof/requestToAegis");
const { kickstart$: createStream$ } = require("@ewise/aegisjs-core/hos/pollingCore");
const { safeMakeWebUrl } = require("@ewise/aegisjs-core/fpcore/safeOps");

const HTTP_VERBS = {
    GET: "GET",
    POST: "POST",
    PUT: "PUT",
    DELETE: "DELETE"
};

const PDV_PATHS = otaUrl => {
    const writeUrl = path => safeMakeWebUrl(path, otaUrl).getOrElse("");
    return {
        GET_INSTITUTIONS: (instCode = "") => writeUrl(`/ota/institutions/${instCode}`),
        START_OTA: writeUrl("/ota/process"),
        QUERY_OTA: (pid, csrf = "") => writeUrl(`/ota/process/${pid}?challenge=${csrf}`),
        RESUME_OTA: (pid = "") => writeUrl(`/ota/process/${pid}`),
        STOP_OTA: (pid, csrf = "") => writeUrl(`/ota/process/${pid}?challenge=${csrf}`)
    };
};

const TERMINAL_PDV_STATES = ["error", "partial", "stopped", "done"];
const stopStreamCondition = ({ status }) => TERMINAL_PDV_STATES.indexOf(status) === -1;

const aegis = (options = {}) => {
    const {
        otaUrl: defaultOtaUrl,
        appId: defaultAppId,
        appSecret: defaultAppSecret,
        uname: defaultUname,
        email: defaultEmail
    } = options;

    return {
        getInstitutions: (args = {}) => {
            const {
                instCode,
                otaUrl = defaultOtaUrl,
                appId = defaultAppId,
                appSecret = defaultAppSecret,
                uname = defaultUname,
                email = defaultEmail
            } = args;

            return requestToAegisOTA(
                HTTP_VERBS.GET,                                     // Method
                { appId, appSecret, uname, email },                 // X-Headers
                null,                                               // Body
                PDV_PATHS(otaUrl).GET_INSTITUTIONS(instCode)        // Path
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
                email = defaultEmail
            } = args;

            const xheaders = { appId, appSecret, uname, email };
            const paths = PDV_PATHS(otaUrl);

            const subject$ = new BehaviorSubject({ processId: null });

            const csrf = uniqid();
            const bodyCsrf = { code: instCode, prompts, challenge: csrf };

            const startAegisOTA = () => requestToAegisOTA(
                HTTP_VERBS.POST,
                xheaders,
                bodyCsrf,
                paths.START_OTA
            );

            const checkAegisOTA = pid => requestToAegisOTA(
                HTTP_VERBS.GET,
                xheaders,
                null,
                paths.QUERY_OTA(pid, csrf)
            );

            const initialStream$ = compose(toObservable, startAegisOTA);
            const pollingStream$ = compose(toObservable, checkAegisOTA);
            const stream$ = createStream$(stopStreamCondition, initialStream$, pollingStream$);

            return {
                run: () =>
                    stream$.subscribe(
                        data => subject$.next(data),
                        err => subject$.error(err),
                        () => subject$.complete()
                    ) && subject$,
                resume: otp =>
                    requestToAegisOTA(
                        HTTP_VERBS.POST,
                        xheaders,
                        { ...otp, challenge: csrf },
                        paths.RESUME_OTA(subject$.getValue().processId)
                    ),
                stop: () =>
                    requestToAegisOTA(
                        HTTP_VERBS.DELETE,
                        xheaders,
                        null,
                        paths.STOP_OTA(subject$.getValue().processId, csrf)
                    )
            };
        }
    };
};

module.exports = (options) =>
    Object.freeze(aegis(options));