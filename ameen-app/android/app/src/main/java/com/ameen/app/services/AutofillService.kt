package com.ameen.app.services

import android.app.PendingIntent
import android.app.assist.AssistStructure
import android.content.Intent
import android.service.autofill.AutofillService
import android.service.autofill.Dataset
import android.service.autofill.FillCallback
import android.service.autofill.FillContext
import android.service.autofill.FillRequest
import android.service.autofill.FillResponse
import android.service.autofill.SaveCallback
import android.service.autofill.SaveInfo
import android.util.Log
import android.view.autofill.AutofillId
import android.view.autofill.AutofillValue
import android.widget.RemoteViews
import com.ameen.app.MainActivity

class AmeenAutofillService : AutofillService() {

    companion object {
        private const val TAG = "AmeenAutofill"

        private data class DemoCredential(
            val title: String,
            val username: String,
            val password: String
        )

        private val demoCredentials = listOf(
            DemoCredential(
                title = "حساب تجريبي",
                username = "user@example.com",
                password = "demo1234"
            ),
            DemoCredential(
                title = "المسؤول",
                username = "admin@ameen.app",
                password = "securePass42"
            ),
            DemoCredential(
                title = "المطور",
                username = "dev",
                password = "ameenDev2024!"
            )
        )
    }

    override fun onFillRequest(request: FillRequest, callback: FillCallback) {
        val context = request.fillContexts.lastOrNull() ?: run {
            callback.onSuccess(null)
            return
        }

        val structure = context.structure
        val parsedForm = AutofillParser.parseLoginForm(structure)

        if (parsedForm == null) {
            callback.onSuccess(null)
            return
        }

        val response = buildFillResponse(parsedForm)
        callback.onSuccess(response)
    }

    private fun buildFillResponse(form: ParsedLoginForm): FillResponse {
        val datasets = mutableListOf<Dataset>()

        for (cred in demoCredentials) {
            val dataset = buildDatasetForCredential(cred, form) ?: continue
            datasets.add(dataset)
        }

        if (datasets.isEmpty()) {
            return FillResponse.Builder().build()
        }

        val responseBuilder = FillResponse.Builder()

        for (dataset in datasets) {
            responseBuilder.addDataset(dataset)
        }

        if (form.usernameField != null && form.passwordField != null) {
            val requiredIds = listOfNotNull(
                form.usernameField?.autofillId,
                form.passwordField?.autofillId
            ).toTypedArray()

            val saveInfo = SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_USERNAME or SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                requiredIds
            ).build()

            responseBuilder.setSaveInfo(saveInfo)
        }

        val unlockIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        responseBuilder.setAuthentication(unlockIntent)

        return responseBuilder.build()
    }

    private fun buildDatasetForCredential(
        cred: DemoCredential,
        form: ParsedLoginForm
    ): Dataset? {
        val datasetBuilder = Dataset.Builder()

        val presentation = RemoteViews(packageName, android.R.layout.simple_list_item_1)
        presentation.setTextViewText(android.R.id.text1, "${cred.title}")
        datasetBuilder.setValue(
            null,
            AutofillValue.forText(cred.title),
            presentation
        )

        form.usernameField?.let { field ->
            val value = when (field.hint) {
                "email" -> cred.username
                "username" -> cred.username
                else -> cred.username
            }
            datasetBuilder.setValue(field.autofillId, AutofillValue.forText(value))
        }

        form.passwordField?.let { field ->
            datasetBuilder.setValue(field.autofillId, AutofillValue.forText(cred.password))
        }

        form.otpField?.let { field ->
            datasetBuilder.setValue(field.autofillId, AutofillValue.forText("123456"))
        }

        return datasetBuilder.build()
    }

    override fun onSaveRequest(request: SaveRequest, callback: SaveCallback) {
        val context = request.fillContexts.lastOrNull()
        val structure = context?.structure ?: run {
            callback.onSuccess()
            return
        }

        val filledFields = extractFilledFields(structure)

        Log.i(TAG, "onSaveRequest: domain=${filledFields["domain"]}")
        Log.i(TAG, "onSaveRequest: username=${filledFields["username"]}")
        Log.i(TAG, "onSaveRequest: password length=${filledFields["password"]?.length ?: 0}")

        // TODO: Wire to actual vault storage when vault implementation is complete
        // vaultRepository.saveCredential(
        //     domain = filledFields["domain"],
        //     username = filledFields["username"],
        //     password = filledFields["password"]
        // )

        callback.onSuccess()
    }

    private fun extractFilledFields(structure: AssistStructure): Map<String, String?> {
        val result = mutableMapOf<String, String?>(
            "domain" to null,
            "username" to null,
            "password" to null
        )

        val allNodes = mutableListOf<AssistStructure.ViewNode>()
        for (windowIdx in 0 until structure.windowNodeCount) {
            allNodes.add(structure.getWindowNodeAt(windowIdx).rootViewNode)
        }

        while (allNodes.isNotEmpty()) {
            val node = allNodes.removeAt(0)
            val hints = node.autofillHints?.toList() ?: emptyList()

            val isUsername = AutofillParser.isUsernameField(node, hints)
            val isPassword = AutofillParser.isPasswordField(node, hints)

            val filledValue = node.autofillValue?.textValue?.toString()

            if (isUsername && filledValue != null) {
                result["username"] = filledValue
                result["domain"] = try {
                    structure.activityComponent?.packageName
                } catch (_: Exception) {
                    null
                }
            }

            if (isPassword && filledValue != null) {
                result["password"] = filledValue
            }

            for (childIdx in 0 until node.childCount) {
                allNodes.add(node.getChildAt(childIdx))
            }
        }

        return result
    }

    override fun onConnected() {
        super.onConnected()
        Log.i(TAG, "AmeenAutofillService connected")
    }
}
