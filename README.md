# aegisJS-ota

[![Build Status](https://travis-ci.org/ewise-systems/aegisJS.svg?branch=develop)](https://travis-ci.org/ewise-systems/aegisJS) [![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4%20adopted-ff69b4.svg)](code-of-conduct.md) [![dependencies Status](https://david-dm.org/ewise-systems/aegisJS/status.svg)](https://david-dm.org/ewise-systems/aegisJS)

Server side data aggregation using eWise Systems' Aegis 2.0 architecture.

## Installation

To use this package at all, you must have separately installed the [eWise Aegis 2.0 PDV](https://www.ewise.com/) to your system, or you must have been provided with an access token by the eWise team to connect to a remotely hosted one.

Once you have secured your access, use the package manager [npm](https://www.npmjs.com/) to install aegisJS.

```bash
npm install @ewise/aegisjs-ota
```

Alternatively, you can download the aegisJS file from the eWise CDN (to be hosted).

## Usage

When requiring aegisJS in the browser, the library is available through the `ewise_aegis_ota` function. When called, this returns the `aegis` object which can talk to the eWise PDV.

```javascript
const aegis = ewise_aegis_ota({
    appId: "",
    appSecret: "",
    username: "",
    email: "",
    otaUrl: "",
});

aegis.getInstitutions().run();
```

Alternatively, you can supply an Orca-issued JWT instead.

```javascript
const aegis = ewise_aegis_ota({
    jwt: "",
    otaUrl: "",
});

aegis.getInstitutions().run();
```

This library returns Task monads for one-off requests to the Aegis PDV and RxJS streams for continuous requests. In the case of a Task monad being returned, it can be converted to a promise should you be more comfortable in that style. However, it is recommended to use the monadic style instead of the promise.

```javascript
// Monadic implementation
aegis.getInstitutions().run().listen({
    onRejected: errorCallback,
    onResolved: successCallback
});

// Promise-based implementation
aegis.getInstitutions().run().promise()
    .then(successCallback)
    .catch(errorCallback);
```

## Example

When run, this example will output the data twice: once for the monadic approach, and again for the promise-based approach.

```javascript
const aegis = ewise_aegis_ota({
    appId: "",
    appSecret: "",
    username: "",
    email: "",
    otaUrl: "",
});

const errorCallback = msg => error => console.log(`Error Encountered from ${msg}:`, error);
const successCallback = msg => data => console.log(`Data Received from ${msg}:`, data);

const details = aegis.getInstitutions();

// Monadic Implementation
details.run().listen({
    onRejected: errorCallback('monad'),
    onResolved: successCallback('monad')
});

// Promise Implementation
details
.run()
.promise()
.then(successCallback('promise'))
.catch(errorCallback('promise'));
```

For more concrete examples, take a look at the `samples/` folder. You can execute these functions by running `npm start` and visiting `localhost:3000`. These functions, as well as the `aegis` object, should be available in the global scope for you to play with and learn from.

## ewise_aegis_ota

### ewise_aegis_ota(options)

This function wraps the `aegis` object and controls how it is instantiated. It will use either JWT or x-headers authentication. If a JWT is supplied, it is used regardless of the other parameters. If the x-headers are supplied all four must be simultaneously provided. Either way, the url to the OTA server is a mandatory parameter.

* `options` \<Object>
  * `otaUrl` \<String> **Required**. The base URL to the OTA server to connect with.
  * `jwt` \<String> **Optional**. When provided, this is the JWT that will be used for all requests, unless specifically overriden in the function's parameters. This becomes `defaultJwt`
  * `appId` \<String> **Required if no JWT**. One of the four x-headers to mark the application ID.
  * `appSecret` \<String> **Required if no JWT**. One of the four x-headers to mark the application secret.
  * `username` \<String> **Required if no JWT**. One of the four x-headers to mark the user's username.
  * `email` \<String> **Required if no JWT**. One of the four x-headers to mark the user's email.
  * `timeout` \<Number> **Optional**. Number of milliseconds to declare that a request has timed out. This becomes `defaultTimeout`. Default: 90,000
  * `retryLimit` \<Number> **Optional**. The number of retries to be attempted when polling. This becomes `defaultRetryLimit`. Default: 5
  * `retryDelay` \<Number> **Optional**. The number of milliseconds to wait after a failure before trying again. This becomes `defaultRetryDelay`. Default: 5,000
  * `withTransactions` \<Boolean> **Optional**. Run aggregation with transactions. Default: `true`
  * `ajaxTaskFn` \<Function> **Optional**. A function that takes six arguments (`HTTP METHOD`, `nullable jwt`, `nullable xheaders`, `nullable body`, `timeout in ms`, `URI or URI Path`) and returns a monad, to overwrite the library's default AJAX implementation. This becomes `defaultAjaxTaskFn`
* Returns: `AegisObject`

## AegisObject

### getInstitutions([options])

The institutions returned here are those that were made available to the client and can be aggregated with the proper credentials.

* `options` \<Object>
  * `instCode` \<String> An institution code that is registered in the eWise PDV.
  * `jwt` \<String> A valid eWise-issued JWT. Default: `defaultJwt`
  * `timeout` \<Number> Number of milliseconds to declare that a request has timed out. Default: `defaultTimeout`
  * `ajaxTaskFn` \<Function> **Optional**. A function that takes six arguments (`HTTP METHOD`, `nullable jwt`, `nullable xheaders`, `nullable body`, `timeout in ms`, `URI or URI Path`) and returns a monad, to overwrite the library's default AJAX implementation. Default: `defaultAjaxTaskFn`
* Returns: `Task(Error, GroupInstitutionsObject | OneInstitutionObject)`

##### GroupInstitutionsObject
* `content` Array\<InstitutionGroup>

##### InstitutionGroup
* `name` \<String> The name of the institution group.
* `description` \<String> A description of the institution group.
* `institutions` Array\<Institution> A list of valid instutitions.

##### Institution
* `code` \<Number> A digit that represents a valid institution that can be aggregated.
* `name` \<String> The name of the institution.

##### OneInstitutionObject
* `code` \<Number> A digit that represents a valid institution that can be aggregated.
* `name` \<String> The name of the institution.
* `prompts` Array\<InstitutionPrompt> A list of prompts required by the institution.

##### InstitutionPrompt
* `editable` \<Boolean> Describes if the prompt's value can be changed.
* `index` \<Integer> Positional descriptor of the prompt in an array.
* `key` \<String> The `key` value which must be returned to the PDV upon supplying the prompt's value.
* `label` \<String> The text that should be displayed to the user upon requesting for the prompt.
* `primary` \<Boolean> Whether the prompt is the main one or not.
* `required` \<Boolean> Whether the prompt is required or not.
* `value` \<Boolean> A default value that must be updated with a user-supplied input if the prompt is editable.
* `type` \<Boolean> Can be `lov` (list of values), `input` (string), `image` (base64 image data string), and `password` (sensitive string).

### initializeOta([options])

Returns an object that can get valid institutions for data aggregation and their prompts, as well as provide means to start, stop and resume the aggregation.

* `options` \<Object>
  * `instCode` \<String> An institution code that is registered in the eWise PDV.
  * `prompts` Array\<Prompt> An array of objects. Each object is made of a `key` corresponding to the `key` returned in `getInstitutions`, and a `value` corresponding to the user-supplied credentials for that key.
  * `jwt` \<String> A valid eWise-issued JWT. Default: `defaultJwt`
  * `timeout` \<Number> **Optional**. Number of milliseconds to declare that a request has timed out. Default: `defaultTimeout`
  * `retryLimit` \<Number> **Optional**. The number of retries to be attempted when polling. Default `defaultRetryLimit`
  * `retryDelay` \<Number> **Optional**. The number of milliseconds to wait after a failure before trying again. Default: `defaultRetryDelay`
  * `ajaxTaskFn` \<Function> **Optional**. A function that takes six arguments (`HTTP METHOD`, `nullable jwt`, `nullable xheaders`, `nullable body`, `timeout in ms`, `URI or URI Path`) and returns a monad, to overwrite the library's default AJAX implementation. Default: `defaultAjaxTaskFn`
* Returns: `StreamControlObject`

## OTAControlObject

### run()

Upon calling this function, the aggregation will return immediately run.

An object that contains a stream and methods to control it. The stream filters out data when it receives duplicate events from the PDV server.

* Returns: a monadic event stream which can be mapped, switched, flattened, etc. Each stream event is a `PDVPollingObject`. Subscribing to this stream will grant you access to each event.

##### PDVPollingObject
* `processId` \<String> A string that uniquely identifies a currently running process.
* `profileId` \<String> A string that uniquely identifies a user's account for a certain institution.
* `status` \<String> Describes the status of the currently running process. It can be `running`, `error`, `userInput`, `stopped`, `partial`, or `done`
* `type` \<String> A string that describes the type of action being performed. Can be `aggregate`.

### resume(prompts)

Resumes the aggregation if it is paused, allowing the stream to continue. Takes an array of Prompts as input.

* Returns: `Task(Error, {})`

### stop()

Terminates the aggregation, which will eventually terminate the stream.

* Returns: `Task(Error, {})`

## Contributing and Community Guidelines
Please see our [contributing guide](https://github.com/ewise-systems/aegisJS/blob/develop/CONTRIBUTING.md) and our [code of conduct](https://github.com/ewise-systems/aegisJS/blob/develop/CODE_OF_CONDUCT.md) for guides on how to contribute to this project.

## License
[MIT](https://github.com/ewise-systems/aegisJS/blob/develop/LICENSE)