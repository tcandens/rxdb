"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RxCollectionBase = void 0;
exports.createRxCollection = createRxCollection;
exports.isRxCollection = isRxCollection;

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _operators = require("rxjs/operators");

var _util = require("./util");

var _rxCollectionHelper = require("./rx-collection-helper");

var _rxQuery = require("./rx-query");

var _rxSchema = require("./rx-schema");

var _rxError = require("./rx-error");

var _crypter = require("./crypter");

var _docCache = require("./doc-cache");

var _queryCache = require("./query-cache");

var _changeEventBuffer = require("./change-event-buffer");

var _hooks = require("./hooks");

var _rxDocument = require("./rx-document");

var _rxDocumentPrototypeMerge = require("./rx-document-prototype-merge");

var _rxStorageHelper = require("./rx-storage-helper");

var _checkNames = require("./plugins/dev-mode/check-names");

var HOOKS_WHEN = ['pre', 'post'];
var HOOKS_KEYS = ['insert', 'save', 'remove', 'create'];
var hooksApplied = false;

var RxCollectionBase = /*#__PURE__*/function () {
  function RxCollectionBase(database, name, schema) {
    var instanceCreationOptions = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
    var migrationStrategies = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
    var methods = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};
    var attachments = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : {};
    var options = arguments.length > 7 && arguments[7] !== undefined ? arguments[7] : {};
    var cacheReplacementPolicy = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : _queryCache.defaultCacheReplacementPolicy;
    var statics = arguments.length > 9 && arguments[9] !== undefined ? arguments[9] : {};
    this._isInMemory = false;
    this.destroyed = false;
    this._atomicUpsertQueues = new Map();
    this.synced = false;
    this.hooks = {};
    this._subs = [];
    this._repStates = new Set();
    this.storageInstance = {};
    this.localDocumentsStore = {};
    this._docCache = (0, _docCache.createDocCache)();
    this._queryCache = (0, _queryCache.createQueryCache)();
    this._crypter = {};
    this._observable$ = {};
    this._changeEventBuffer = {};
    this.database = database;
    this.name = name;
    this.schema = schema;
    this.instanceCreationOptions = instanceCreationOptions;
    this.migrationStrategies = migrationStrategies;
    this.methods = methods;
    this.attachments = attachments;
    this.options = options;
    this.cacheReplacementPolicy = cacheReplacementPolicy;
    this.statics = statics;

    _applyHookFunctions(this.asRxCollection);
  }
  /**
   * returns observable
   */


  var _proto = RxCollectionBase.prototype;

  _proto.prepare = /*#__PURE__*/function () {
    var _prepare = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(
    /**
     * set to true if the collection data already exists on this storage adapter
     */
    wasCreatedBefore) {
      var _this = this;

      var storageInstanceCreationParams, _yield$createRxCollec, storageInstance, localDocumentsStore, subDocs, subLocalDocs;

      return _regenerator["default"].wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              storageInstanceCreationParams = {
                databaseName: this.database.name,
                collectionName: this.name,
                schema: this.schema.jsonSchema,
                options: this.instanceCreationOptions
              };
              (0, _hooks.runPluginHooks)('preCreateRxStorageInstance', storageInstanceCreationParams);
              _context.next = 4;
              return (0, _rxCollectionHelper.createRxCollectionStorageInstances)(this.name, this.database, storageInstanceCreationParams, this.instanceCreationOptions);

            case 4:
              _yield$createRxCollec = _context.sent;
              storageInstance = _yield$createRxCollec.storageInstance;
              localDocumentsStore = _yield$createRxCollec.localDocumentsStore;
              this.storageInstance = storageInstance;
              this.localDocumentsStore = localDocumentsStore; // we trigger the non-blocking things first and await them later so we can do stuff in the mean time

              this._crypter = (0, _crypter.createCrypter)(this.database.password, this.schema);
              this._observable$ = this.database.$.pipe((0, _operators.filter)(function (event) {
                return event.collectionName === _this.name;
              }));
              this._changeEventBuffer = (0, _changeEventBuffer.createChangeEventBuffer)(this.asRxCollection);
              subDocs = storageInstance.changeStream().pipe((0, _operators.map)(function (storageEvent) {
                return (0, _rxStorageHelper.storageChangeEventToRxChangeEvent)(false, storageEvent, _this.database, _this);
              })).subscribe(function (cE) {
                _this.$emit(cE);
              });

              this._subs.push(subDocs);

              subLocalDocs = this.localDocumentsStore.changeStream().pipe((0, _operators.map)(function (storageEvent) {
                return (0, _rxStorageHelper.storageChangeEventToRxChangeEvent)(true, storageEvent, _this.database, _this);
              })).subscribe(function (cE) {
                return _this.$emit(cE);
              });

              this._subs.push(subLocalDocs);
              /**
               * When a write happens to the collection
               * we find the changed document in the docCache
               * and tell it that it has to change its data.
               */


              this._subs.push(this._observable$.pipe((0, _operators.filter)(function (cE) {
                return !cE.isLocal;
              })).subscribe(function (cE) {
                // when data changes, send it to RxDocument in docCache
                var doc = _this._docCache.get(cE.documentId);

                if (doc) {
                  doc._handleChangeEvent(cE);
                }
              }));

            case 17:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    function prepare(_x) {
      return _prepare.apply(this, arguments);
    }

    return prepare;
  }() // overwritte by migration-plugin
  ;

  _proto.migrationNeeded = function migrationNeeded() {
    if (this.schema.version === 0) {
      return Promise.resolve(false);
    }

    throw (0, _util.pluginMissing)('migration');
  };

  _proto.getDataMigrator = function getDataMigrator() {
    throw (0, _util.pluginMissing)('migration');
  };

  _proto.migrate = function migrate() {
    var batchSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;
    return this.getDataMigrator().migrate(batchSize);
  };

  _proto.migratePromise = function migratePromise() {
    var batchSize = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 10;
    return this.getDataMigrator().migratePromise(batchSize);
  }
  /**
   * wrapps the query function of the storage instance.
   */
  ;

  _proto._queryStorageInstance =
  /*#__PURE__*/
  function () {
    var _queryStorageInstance2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(rxQuery, limit) {
      var _this2 = this;

      var noDecrypt,
          preparedQuery,
          queryResult,
          docs,
          _args2 = arguments;
      return _regenerator["default"].wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              noDecrypt = _args2.length > 2 && _args2[2] !== undefined ? _args2[2] : false;
              preparedQuery = rxQuery.toJSON();

              if (limit) {
                preparedQuery['limit'] = limit;
              }

              _context2.next = 5;
              return this.database.lockedRun(function () {
                return _this2.storageInstance.query(preparedQuery);
              });

            case 5:
              queryResult = _context2.sent;
              docs = queryResult.documents.map(function (doc) {
                return (0, _rxCollectionHelper._handleFromStorageInstance)(_this2, doc, noDecrypt);
              });
              return _context2.abrupt("return", docs);

            case 8:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this);
    }));

    function _queryStorageInstance(_x2, _x3) {
      return _queryStorageInstance2.apply(this, arguments);
    }

    return _queryStorageInstance;
  }();

  _proto.$emit = function $emit(changeEvent) {
    return this.database.$emit(changeEvent);
  }
  /**
   * TODO internally call bulkInsert
   * to not have duplicated code.
   */
  ;

  _proto.insert =
  /*#__PURE__*/
  function () {
    var _insert = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(json) {
      var tempDoc, useJson, newDoc, insertResult;
      return _regenerator["default"].wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              // inserting a temporary-document
              tempDoc = null;

              if (!(0, _rxDocument.isRxDocument)(json)) {
                _context3.next = 6;
                break;
              }

              tempDoc = json;

              if (tempDoc._isTemporary) {
                _context3.next = 5;
                break;
              }

              throw (0, _rxError.newRxError)('COL1', {
                data: json
              });

            case 5:
              json = tempDoc.toJSON();

            case 6:
              useJson = (0, _rxCollectionHelper.fillObjectDataBeforeInsert)(this, json);
              newDoc = tempDoc;
              _context3.next = 10;
              return this._runHooks('pre', 'insert', useJson);

            case 10:
              this.schema.validate(useJson);
              _context3.next = 13;
              return (0, _rxCollectionHelper.writeToStorageInstance)(this, {
                document: useJson
              });

            case 13:
              insertResult = _context3.sent;

              if (tempDoc) {
                tempDoc._dataSync$.next(insertResult);
              } else {
                newDoc = (0, _rxDocumentPrototypeMerge.createRxDocument)(this, insertResult);
              }

              _context3.next = 17;
              return this._runHooks('post', 'insert', useJson, newDoc);

            case 17:
              return _context3.abrupt("return", newDoc);

            case 18:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));

    function insert(_x4) {
      return _insert.apply(this, arguments);
    }

    return insert;
  }();

  _proto.bulkInsert = /*#__PURE__*/function () {
    var _bulkInsert = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(docsData) {
      var _this3 = this;

      var useDocs, docs, insertDocs, docsMap, results, successEntries, rxDocuments;
      return _regenerator["default"].wrap(function _callee4$(_context4) {
        while (1) {
          switch (_context4.prev = _context4.next) {
            case 0:
              if (!(docsData.length === 0)) {
                _context4.next = 2;
                break;
              }

              return _context4.abrupt("return", {
                success: [],
                error: []
              });

            case 2:
              useDocs = docsData.map(function (docData) {
                var useDocData = (0, _rxCollectionHelper.fillObjectDataBeforeInsert)(_this3, docData);
                return useDocData;
              });
              _context4.next = 5;
              return Promise.all(useDocs.map(function (doc) {
                return _this3._runHooks('pre', 'insert', doc).then(function () {
                  _this3.schema.validate(doc);

                  return doc;
                });
              }));

            case 5:
              docs = _context4.sent;
              insertDocs = docs.map(function (d) {
                return {
                  document: (0, _rxCollectionHelper._handleToStorageInstance)(_this3, d)
                };
              });
              docsMap = new Map();
              docs.forEach(function (d) {
                docsMap.set(d[_this3.schema.primaryPath], d);
              });
              _context4.next = 11;
              return this.database.lockedRun(function () {
                return _this3.storageInstance.bulkWrite(insertDocs);
              });

            case 11:
              results = _context4.sent;
              // create documents
              successEntries = Array.from(results.success.entries());
              rxDocuments = successEntries.map(function (_ref) {
                var key = _ref[0],
                    writtenDocData = _ref[1];
                var docData = (0, _util.getFromMapOrThrow)(docsMap, key);
                docData._rev = writtenDocData._rev;
                var doc = (0, _rxDocumentPrototypeMerge.createRxDocument)(_this3, docData);
                return doc;
              });
              _context4.next = 16;
              return Promise.all(rxDocuments.map(function (doc) {
                return _this3._runHooks('post', 'insert', docsMap.get(doc.primary), doc);
              }));

            case 16:
              return _context4.abrupt("return", {
                success: rxDocuments,
                error: Array.from(results.error.values())
              });

            case 17:
            case "end":
              return _context4.stop();
          }
        }
      }, _callee4, this);
    }));

    function bulkInsert(_x5) {
      return _bulkInsert.apply(this, arguments);
    }

    return bulkInsert;
  }();

  _proto.bulkRemove = /*#__PURE__*/function () {
    var _bulkRemove = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5(ids) {
      var _this4 = this;

      var rxDocumentMap, docsData, docsMap, removeDocs, results, successIds, rxDocuments;
      return _regenerator["default"].wrap(function _callee5$(_context5) {
        while (1) {
          switch (_context5.prev = _context5.next) {
            case 0:
              if (!(ids.length === 0)) {
                _context5.next = 2;
                break;
              }

              return _context5.abrupt("return", {
                success: [],
                error: []
              });

            case 2:
              _context5.next = 4;
              return this.findByIds(ids);

            case 4:
              rxDocumentMap = _context5.sent;
              docsData = [];
              docsMap = new Map();
              Array.from(rxDocumentMap.values()).forEach(function (rxDocument) {
                var data = (0, _util.clone)(rxDocument.toJSON(true));
                docsData.push(data);
                docsMap.set(rxDocument.primary, data);
              });
              _context5.next = 10;
              return Promise.all(docsData.map(function (doc) {
                var primary = doc[_this4.schema.primaryPath];
                return _this4._runHooks('pre', 'remove', doc, rxDocumentMap.get(primary));
              }));

            case 10:
              removeDocs = docsData.map(function (doc) {
                var writeDoc = (0, _util.flatClone)(doc);
                writeDoc._deleted = true;
                return {
                  previous: (0, _rxCollectionHelper._handleToStorageInstance)(_this4, doc),
                  document: (0, _rxCollectionHelper._handleToStorageInstance)(_this4, writeDoc)
                };
              });
              _context5.next = 13;
              return this.database.lockedRun(function () {
                return _this4.storageInstance.bulkWrite(removeDocs);
              });

            case 13:
              results = _context5.sent;
              successIds = Array.from(results.success.keys()); // run hooks

              _context5.next = 17;
              return Promise.all(successIds.map(function (id) {
                return _this4._runHooks('post', 'remove', docsMap.get(id), rxDocumentMap.get(id));
              }));

            case 17:
              rxDocuments = successIds.map(function (id) {
                return rxDocumentMap.get(id);
              });
              return _context5.abrupt("return", {
                success: rxDocuments,
                error: Array.from(results.error.values())
              });

            case 19:
            case "end":
              return _context5.stop();
          }
        }
      }, _callee5, this);
    }));

    function bulkRemove(_x6) {
      return _bulkRemove.apply(this, arguments);
    }

    return bulkRemove;
  }()
  /**
   * same as insert but overwrites existing document with same primary
   */
  ;

  _proto.upsert = function upsert(json) {
    var _this5 = this;

    var useJson = (0, _rxCollectionHelper.fillObjectDataBeforeInsert)(this, json);
    var primary = useJson[this.schema.primaryPath];

    if (!primary) {
      throw (0, _rxError.newRxError)('COL3', {
        primaryPath: this.schema.primaryPath,
        data: useJson,
        schema: this.schema.jsonSchema
      });
    }

    return this.findOne(primary).exec().then(function (existing) {
      if (existing) {
        useJson._rev = existing['_rev'];
        return existing.atomicUpdate(function () {
          return useJson;
        }).then(function () {
          return existing;
        });
      } else {
        return _this5.insert(json);
      }
    });
  }
  /**
   * upserts to a RxDocument, uses atomicUpdate if document already exists
   */
  ;

  _proto.atomicUpsert = function atomicUpsert(json) {
    var _this6 = this;

    var useJson = (0, _rxCollectionHelper.fillObjectDataBeforeInsert)(this, json);
    var primary = useJson[this.schema.primaryPath];

    if (!primary) {
      throw (0, _rxError.newRxError)('COL4', {
        data: json
      });
    } // ensure that it wont try 2 parallel runs


    var queue;

    if (!this._atomicUpsertQueues.has(primary)) {
      queue = Promise.resolve();
    } else {
      queue = this._atomicUpsertQueues.get(primary);
    }

    queue = queue.then(function () {
      return _atomicUpsertEnsureRxDocumentExists(_this6, primary, useJson);
    }).then(function (wasInserted) {
      if (!wasInserted.inserted) {
        return _atomicUpsertUpdate(wasInserted.doc, useJson)
        /**
         * tick here so the event can propagate
         * TODO we should not need that here
         */
        .then(function () {
          return (0, _util.nextTick)();
        }).then(function () {
          return (0, _util.nextTick)();
        }).then(function () {
          return (0, _util.nextTick)();
        }).then(function () {
          return wasInserted.doc;
        });
      } else return wasInserted.doc;
    });

    this._atomicUpsertQueues.set(primary, queue);

    return queue;
  };

  _proto.find = function find(queryObj) {
    if (typeof queryObj === 'string') {
      throw (0, _rxError.newRxError)('COL5', {
        queryObj: queryObj
      });
    }

    if (!queryObj) {
      queryObj = (0, _rxQuery._getDefaultQuery)(this);
    }

    var query = (0, _rxQuery.createRxQuery)('find', queryObj, this);
    return query;
  };

  _proto.findOne = function findOne(queryObj) {
    var query;

    if (typeof queryObj === 'string') {
      var _selector;

      query = (0, _rxQuery.createRxQuery)('findOne', {
        selector: (_selector = {}, _selector[this.schema.primaryPath] = queryObj, _selector)
      }, this);
    } else {
      if (!queryObj) {
        queryObj = (0, _rxQuery._getDefaultQuery)(this);
      } // cannot have limit on findOne queries


      if (queryObj.limit) {
        throw (0, _rxError.newRxError)('QU6');
      }

      query = (0, _rxQuery.createRxQuery)('findOne', queryObj, this);
    }

    if (typeof queryObj === 'number' || Array.isArray(queryObj)) {
      throw (0, _rxError.newRxTypeError)('COL6', {
        queryObj: queryObj
      });
    }

    return query;
  }
  /**
   * find a list documents by their primary key
   * has way better performance then running multiple findOne() or a find() with a complex $or-selected
   */
  ;

  _proto.findByIds =
  /*#__PURE__*/
  function () {
    var _findByIds = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee6(ids) {
      var _this7 = this;

      var ret, mustBeQueried, docs;
      return _regenerator["default"].wrap(function _callee6$(_context6) {
        while (1) {
          switch (_context6.prev = _context6.next) {
            case 0:
              ret = new Map();
              mustBeQueried = []; // first try to fill from docCache

              ids.forEach(function (id) {
                var doc = _this7._docCache.get(id);

                if (doc) {
                  ret.set(id, doc);
                } else {
                  mustBeQueried.push(id);
                }
              }); // find everything which was not in docCache

              if (!(mustBeQueried.length > 0)) {
                _context6.next = 8;
                break;
              }

              _context6.next = 6;
              return this.storageInstance.findDocumentsById(mustBeQueried, false);

            case 6:
              docs = _context6.sent;
              Array.from(docs.values()).forEach(function (docData) {
                docData = (0, _rxCollectionHelper._handleFromStorageInstance)(_this7, docData);
                var doc = (0, _rxDocumentPrototypeMerge.createRxDocument)(_this7, docData);
                ret.set(doc.primary, doc);
              });

            case 8:
              return _context6.abrupt("return", ret);

            case 9:
            case "end":
              return _context6.stop();
          }
        }
      }, _callee6, this);
    }));

    function findByIds(_x7) {
      return _findByIds.apply(this, arguments);
    }

    return findByIds;
  }()
  /**
   * like this.findByIds but returns an observable
   * that always emitts the current state
   */
  ;

  _proto.findByIds$ = function findByIds$(ids) {
    var _this8 = this;

    var currentValue = null;
    var lastChangeEvent = -1;
    var initialPromise = this.findByIds(ids).then(function (docsMap) {
      lastChangeEvent = _this8._changeEventBuffer.counter;
      currentValue = docsMap;
    });
    return this.$.pipe((0, _operators.startWith)(null), (0, _operators.mergeMap)(function (ev) {
      return initialPromise.then(function () {
        return ev;
      });
    }),
    /**
     * Because shareReplay with refCount: true
     * will often subscribe/unsusbscribe
     * we always ensure that we handled all missed events
     * since the last subscription.
     */
    (0, _operators.mergeMap)( /*#__PURE__*/function () {
      var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee7(ev) {
        var resultMap, missedChangeEvents, newResult;
        return _regenerator["default"].wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                resultMap = (0, _util.ensureNotFalsy)(currentValue);
                missedChangeEvents = _this8._changeEventBuffer.getFrom(lastChangeEvent + 1);

                if (!(missedChangeEvents === null)) {
                  _context7.next = 10;
                  break;
                }

                _context7.next = 5;
                return _this8.findByIds(ids);

              case 5:
                newResult = _context7.sent;
                lastChangeEvent = _this8._changeEventBuffer.counter;
                Array.from(newResult.entries()).forEach(function (_ref3) {
                  var k = _ref3[0],
                      v = _ref3[1];
                  return resultMap.set(k, v);
                });
                _context7.next = 11;
                break;

              case 10:
                missedChangeEvents.filter(function (rxChangeEvent) {
                  return ids.includes(rxChangeEvent.documentId);
                }).forEach(function (rxChangeEvent) {
                  var op = rxChangeEvent.operation;

                  if (op === 'INSERT' || op === 'UPDATE') {
                    resultMap.set(rxChangeEvent.documentId, _this8._docCache.get(rxChangeEvent.documentId));
                  } else {
                    resultMap["delete"](rxChangeEvent.documentId);
                  }
                });

              case 11:
                return _context7.abrupt("return", resultMap);

              case 12:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7);
      }));

      return function (_x8) {
        return _ref2.apply(this, arguments);
      };
    }()), (0, _operators.filter)(function (x) {
      return !!x;
    }), (0, _operators.shareReplay)({
      bufferSize: 1,
      refCount: true
    }));
  }
  /**
   * Export collection to a JSON friendly format.
   * @param _decrypted
   * When true, all encrypted values will be decrypted.
   * When false or omitted and an interface or type is loaded in this collection,
   * all base properties of the type are typed as `any` since data could be encrypted.
   */
  ;

  _proto.exportJSON = function exportJSON() {
    var _decrypted = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

    throw (0, _util.pluginMissing)('json-dump');
  }
  /**
   * Import the parsed JSON export into the collection.
   * @param _exportedJSON The previously exported data from the `<collection>.exportJSON()` method.
   */
  ;

  _proto.importJSON = function importJSON(_exportedJSON) {
    throw (0, _util.pluginMissing)('json-dump');
  }
  /**
   * sync with a CouchDB endpoint
   */
  ;

  _proto.syncCouchDB = function syncCouchDB(_syncOptions) {
    throw (0, _util.pluginMissing)('replication');
  }
  /**
   * sync with a GraphQL endpoint
   */
  ;

  _proto.syncGraphQL = function syncGraphQL(options) {
    throw (0, _util.pluginMissing)('replication-graphql');
  }
  /**
   * Create a replicated in-memory-collection
   */
  ;

  _proto.inMemory = function inMemory() {
    throw (0, _util.pluginMissing)('in-memory');
  }
  /**
   * HOOKS
   */
  ;

  _proto.addHook = function addHook(when, key, fun) {
    var parallel = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    if (typeof fun !== 'function') {
      throw (0, _rxError.newRxTypeError)('COL7', {
        key: key,
        when: when
      });
    }

    if (!HOOKS_WHEN.includes(when)) {
      throw (0, _rxError.newRxTypeError)('COL8', {
        key: key,
        when: when
      });
    }

    if (!HOOKS_KEYS.includes(key)) {
      throw (0, _rxError.newRxError)('COL9', {
        key: key
      });
    }

    if (when === 'post' && key === 'create' && parallel === true) {
      throw (0, _rxError.newRxError)('COL10', {
        when: when,
        key: key,
        parallel: parallel
      });
    } // bind this-scope to hook-function


    var boundFun = fun.bind(this);
    var runName = parallel ? 'parallel' : 'series';
    this.hooks[key] = this.hooks[key] || {};
    this.hooks[key][when] = this.hooks[key][when] || {
      series: [],
      parallel: []
    };
    this.hooks[key][when][runName].push(boundFun);
  };

  _proto.getHooks = function getHooks(when, key) {
    try {
      return this.hooks[key][when];
    } catch (e) {
      return {
        series: [],
        parallel: []
      };
    }
  };

  _proto._runHooks = function _runHooks(when, key, data, instance) {
    var hooks = this.getHooks(when, key);
    if (!hooks) return Promise.resolve(); // run parallel: false

    var tasks = hooks.series.map(function (hook) {
      return function () {
        return hook(data, instance);
      };
    });
    return (0, _util.promiseSeries)(tasks) // run parallel: true
    .then(function () {
      return Promise.all(hooks.parallel.map(function (hook) {
        return hook(data, instance);
      }));
    });
  }
  /**
   * does the same as ._runHooks() but with non-async-functions
   */
  ;

  _proto._runHooksSync = function _runHooksSync(when, key, data, instance) {
    var hooks = this.getHooks(when, key);
    if (!hooks) return;
    hooks.series.forEach(function (hook) {
      return hook(data, instance);
    });
  }
  /**
   * creates a temporaryDocument which can be saved later
   */
  ;

  _proto.newDocument = function newDocument() {
    var docData = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    docData = this.schema.fillObjectWithDefaults(docData);
    var doc = (0, _rxDocument.createWithConstructor)((0, _rxDocumentPrototypeMerge.getRxDocumentConstructor)(this), this, docData);
    doc._isTemporary = true;

    this._runHooksSync('post', 'create', docData, doc);

    return doc;
  };

  _proto.destroy = function destroy() {
    var _this9 = this;

    if (this.destroyed) {
      return Promise.resolve(false);
    }

    if (this._onDestroyCall) {
      this._onDestroyCall();
    }

    this._subs.forEach(function (sub) {
      return sub.unsubscribe();
    });

    if (this._changeEventBuffer) {
      this._changeEventBuffer.destroy();
    }

    Array.from(this._repStates).forEach(function (replicationState) {
      return replicationState.cancel();
    });
    return this.storageInstance.close().then(function () {
      delete _this9.database.collections[_this9.name];
      _this9.destroyed = true;
      return (0, _hooks.runAsyncPluginHooks)('postDestroyRxCollection', _this9).then(function () {
        return true;
      });
    });
  }
  /**
   * remove all data of the collection
   */
  ;

  _proto.remove = function remove() {
    return this.database.removeCollection(this.name);
  };

  (0, _createClass2["default"])(RxCollectionBase, [{
    key: "$",
    get: function get() {
      return this._observable$;
    }
  }, {
    key: "insert$",
    get: function get() {
      return this.$.pipe((0, _operators.filter)(function (cE) {
        return cE.operation === 'INSERT';
      }));
    }
  }, {
    key: "update$",
    get: function get() {
      return this.$.pipe((0, _operators.filter)(function (cE) {
        return cE.operation === 'UPDATE';
      }));
    }
  }, {
    key: "remove$",
    get: function get() {
      return this.$.pipe((0, _operators.filter)(function (cE) {
        return cE.operation === 'DELETE';
      }));
    }
  }, {
    key: "onDestroy",
    get: function get() {
      var _this10 = this;

      if (!this._onDestroy) {
        this._onDestroy = new Promise(function (res) {
          return _this10._onDestroyCall = res;
        });
      }

      return this._onDestroy;
    }
  }, {
    key: "asRxCollection",
    get: function get() {
      return this;
    }
  }]);
  return RxCollectionBase;
}();
/**
 * adds the hook-functions to the collections prototype
 * this runs only once
 */


exports.RxCollectionBase = RxCollectionBase;

function _applyHookFunctions(collection) {
  if (hooksApplied) return; // already run

  hooksApplied = true;
  var colProto = Object.getPrototypeOf(collection);
  HOOKS_KEYS.forEach(function (key) {
    HOOKS_WHEN.map(function (when) {
      var fnName = when + (0, _util.ucfirst)(key);

      colProto[fnName] = function (fun, parallel) {
        return this.addHook(when, key, fun, parallel);
      };
    });
  });
}

function _atomicUpsertUpdate(doc, json) {
  return doc.atomicUpdate(function (innerDoc) {
    json._rev = innerDoc._rev;
    innerDoc._data = json;
    return innerDoc._data;
  }).then(function () {
    return doc;
  });
}
/**
 * ensures that the given document exists
 * @return promise that resolves with new doc and flag if inserted
 */


function _atomicUpsertEnsureRxDocumentExists(rxCollection, primary, json) {
  /**
   * Optimisation shortcut,
   * first try to find the document in the doc-cache
   */
  var docFromCache = rxCollection._docCache.get(primary);

  if (docFromCache) {
    return Promise.resolve({
      doc: docFromCache,
      inserted: false
    });
  }

  return rxCollection.findOne(primary).exec().then(function (doc) {
    if (!doc) {
      return rxCollection.insert(json).then(function (newDoc) {
        return {
          doc: newDoc,
          inserted: true
        };
      });
    } else {
      return {
        doc: doc,
        inserted: false
      };
    }
  });
}
/**
 * creates and prepares a new collection
 */


function createRxCollection(_ref4, wasCreatedBefore) {
  var database = _ref4.database,
      name = _ref4.name,
      schema = _ref4.schema,
      _ref4$instanceCreatio = _ref4.instanceCreationOptions,
      instanceCreationOptions = _ref4$instanceCreatio === void 0 ? {} : _ref4$instanceCreatio,
      _ref4$migrationStrate = _ref4.migrationStrategies,
      migrationStrategies = _ref4$migrationStrate === void 0 ? {} : _ref4$migrationStrate,
      _ref4$autoMigrate = _ref4.autoMigrate,
      autoMigrate = _ref4$autoMigrate === void 0 ? true : _ref4$autoMigrate,
      _ref4$statics = _ref4.statics,
      statics = _ref4$statics === void 0 ? {} : _ref4$statics,
      _ref4$methods = _ref4.methods,
      methods = _ref4$methods === void 0 ? {} : _ref4$methods,
      _ref4$attachments = _ref4.attachments,
      attachments = _ref4$attachments === void 0 ? {} : _ref4$attachments,
      _ref4$options = _ref4.options,
      options = _ref4$options === void 0 ? {} : _ref4$options,
      _ref4$cacheReplacemen = _ref4.cacheReplacementPolicy,
      cacheReplacementPolicy = _ref4$cacheReplacemen === void 0 ? _queryCache.defaultCacheReplacementPolicy : _ref4$cacheReplacemen;
  (0, _checkNames.validateDatabaseName)(name); // ensure it is a schema-object

  if (!(0, _rxSchema.isInstanceOf)(schema)) {
    schema = (0, _rxSchema.createRxSchema)(schema);
  }

  Object.keys(methods).filter(function (funName) {
    return schema.topLevelFields.includes(funName);
  }).forEach(function (funName) {
    throw (0, _rxError.newRxError)('COL18', {
      funName: funName
    });
  });
  var collection = new RxCollectionBase(database, name, schema, instanceCreationOptions, migrationStrategies, methods, attachments, options, cacheReplacementPolicy, statics);
  return collection.prepare(wasCreatedBefore).then(function () {
    // ORM add statics
    Object.entries(statics).forEach(function (_ref5) {
      var funName = _ref5[0],
          fun = _ref5[1];
      Object.defineProperty(collection, funName, {
        get: function get() {
          return fun.bind(collection);
        }
      });
    });
    var ret = Promise.resolve();

    if (autoMigrate && collection.schema.version !== 0) {
      ret = collection.migratePromise();
    }

    return ret;
  }).then(function () {
    (0, _hooks.runPluginHooks)('createRxCollection', collection);
    return collection;
  });
}

function isRxCollection(obj) {
  return obj instanceof RxCollectionBase;
}

//# sourceMappingURL=rx-collection.js.map