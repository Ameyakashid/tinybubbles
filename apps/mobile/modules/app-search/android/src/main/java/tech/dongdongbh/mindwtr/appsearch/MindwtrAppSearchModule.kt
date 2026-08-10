package tech.dongdongbh.mindwtr.appsearch

import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MindwtrAppSearchModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MindwtrAppSearch")

    Function("isSupported") {
      MindwtrAppSearchIndex.isSupported()
    }

    AsyncFunction("upsertDocuments") { docs: List<Map<String, Any?>>, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val parsed = docs.mapNotNull(MindwtrAppSearchDoc::fromMap)
      MindwtrAppSearchIndex.upsert(context, parsed) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { promise.reject("ERR_APPSEARCH_UPSERT", it.message, it) }
        )
      }
    }

    AsyncFunction("removeDocuments") { ids: List<String>, promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      MindwtrAppSearchIndex.remove(context, ids) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { promise.reject("ERR_APPSEARCH_REMOVE", it.message, it) }
        )
      }
    }

    AsyncFunction("wipeAll") { promise: Promise ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      MindwtrAppSearchIndex.wipeAll(context) { result ->
        result.fold(
          onSuccess = { promise.resolve(null) },
          onFailure = { promise.reject("ERR_APPSEARCH_WIPE", it.message, it) }
        )
      }
    }
  }
}
