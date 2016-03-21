/*
 * Copyright 2014 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

module.exports = function ($http, $q, jolokia) {
    var findInArray = function (a, name) {
        for (var i = 0; i < a.length; i++) {
            var match = /ch.qos.logback.classic:Name=([^,]+)/.exec(a[i]);
            if (match !== null && match[1].toUpperCase() === name.toUpperCase()) {
                return a[i];
            }
        }
        return null;
    };

    var findLogbackMbean = function (app) {
        return jolokia.search('api/applications/' + app.id + '/jolokia/', 'ch.qos.logback.classic:Name=*,Type=ch.qos.logback.classic.jmx.JMXConfigurator').then(function (response) {
            if (response.value.length === 1) {
                return response.value[0];
            }
            if (response.value.length > 1) {
                //find the one with the appname or default
                var value = findInArray(response.value, app.name);
                if (value === null) {
                    value = findInArray(response.value, 'default');
                }
                if (value !== null) {
                    return value;
                }
                return $q.reject({ error:'Ambigious Logback JMXConfigurator-MBeans found!', candidates: response.value});
            }
            return $q.reject({ error: 'Couldn\'t find Logback JMXConfigurator-MBean' });
        });
    };

    /**
     * Logback logging backend.
     * @param app App.
     * @returns Logback logging backend.
     */
    var logback = function(app) {
        return findLogbackMbean(app).then(function (logbackMbean) {
            return {
                getLoglevels: function (loggers) {
                    var requests = [];
                    for (var j in loggers) {
                        requests.push({
                            type: 'exec',
                            mbean: logbackMbean,
                            operation: 'getLoggerEffectiveLevel',
                            arguments: [loggers[j].name]
                        });
                    }
                    return jolokia.bulkRequest('api/applications/' + app.id + '/jolokia/', requests).then(function(responses) {
                        var result = [];
                        for (var j in responses) {
                            result.push({
                                name: responses[j].request.arguments[0],
                                level: responses[j].value
                            });
                        }

                        var deferred = $q.defer();
                        deferred.resolve(result);
                        return deferred.promise;
                    });
                },
                setLoglevel: function (logger, level) {
                    return jolokia.exec('api/applications/' + app.id + '/jolokia/', logbackMbean, 'setLoggerLevel', [logger,
                        level
                    ]);
                },
                getAllLoggersNames: function () {
                    return jolokia.readAttr('api/applications/' + app.id + '/jolokia/', logbackMbean, 'LoggerList')
                        .then(function (response) {
                            var loggers = [];
                            for (var i in response.value) {
                                loggers.push(response.value[i]);
                            }
                            var deferred = $q.defer();
                            deferred.resolve(loggers);
                            return deferred.promise;
                        });
                }
            };
        });
    };

    var log4j2 = function(app) {
        var deferred = $q.defer();

        var result = {
            getLoglevels: function (loggers) {
                var deferred = $q.defer();
                deferred.resolve([]);
                return deferred.promise;
            },
            setLoglevel: function (logger, level) {
                var deferred = $q.defer();
                deferred.resolve();
                return deferred.promise;
            },
            getAllLoggersNames: function () {
                var deferred = $q.defer();
                deferred.resolve([]);
                return deferred.promise;
            }
        };
        deferred.resolve(result);
        return deferred.promise;
    };

    /**
     * Mock logging backend.
     *
     * @returns Mock logging backend.
     */
    var mock = function() {
        var deferred = $q.defer();

        var result = {
            getLoglevels: function (loggers) {
                var deferred = $q.defer();
                deferred.resolve([
                    {
                        name: '1',
                        level: 'TRACE'
                    }, {
                        name: '2',
                        level: 'DEBUG'
                    }, {
                        name: '3',
                        level: 'INFO'
                    }, {
                        name: '4',
                        level: 'WARN'
                    }, {
                        name: '5',
                        level: 'ERROR'
                    }, {
                        name: '6',
                        level: 'OFF'
                    }
                ]);
                return deferred.promise;
            },
            setLoglevel: function (logger, level) {
                var deferred = $q.defer();
                deferred.resolve();
                return deferred.promise;
            },
            getAllLoggersNames: function () {
                var deferred = $q.defer();
                deferred.resolve(['1', '2', '3', '4', '5', '6']);
                return deferred.promise;
            }
        };
        deferred.resolve(result);
        return deferred.promise;
    };

    this.getLoggingConfigurator = function (app) {
        // return logback(app);
        // return mock();
        return log4j2(app);
    };
};
