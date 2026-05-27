package com.ameen.app.services

import android.app.assist.AssistStructure
import android.text.InputType
import android.view.View
import android.view.autofill.AutofillId

data class ParsedFormField(
    val autofillId: AutofillId,
    val hint: String,
    val value: String?
)

data class ParsedLoginForm(
    val usernameField: ParsedFormField?,
    val passwordField: ParsedFormField?,
    val otpField: ParsedFormField?,
    val domain: String?
)

object AutofillParser {

    fun parseLoginForm(structure: AssistStructure): ParsedLoginForm? {
        val nodes = collectAutofillableNodes(structure)

        var usernameField: ParsedFormField? = null
        var passwordField: ParsedFormField? = null
        var otpField: ParsedFormField? = null

        for (node in nodes) {
            val hints = node.autofillHints?.toList() ?: emptyList()

            when {
                isPasswordField(node, hints) -> {
                    if (passwordField == null) {
                        passwordField = ParsedFormField(
                            autofillId = node.autofillId,
                            hint = "password",
                            value = node.autofillValue?.textValue?.toString()
                        )
                    }
                }
                isOtpField(node, hints) -> {
                    if (otpField == null) {
                        otpField = ParsedFormField(
                            autofillId = node.autofillId,
                            hint = "otp",
                            value = node.autofillValue?.textValue?.toString()
                        )
                    }
                }
                isUsernameField(node, hints) -> {
                    if (usernameField == null) {
                        val hintType = if (hints.contains(View.AUTOFILL_HINT_EMAIL_ADDRESS)) "email" else "username"
                        usernameField = ParsedFormField(
                            autofillId = node.autofillId,
                            hint = hintType,
                            value = node.autofillValue?.textValue?.toString()
                        )
                    }
                }
            }
        }

        val domain = extractDomain(structure)

        if (usernameField != null || passwordField != null || otpField != null) {
            return ParsedLoginForm(usernameField, passwordField, otpField, domain)
        }

        return null
    }

    fun isUsernameField(node: AssistStructure.ViewNode, hints: List<String>): Boolean {
        if (hints.contains(View.AUTOFILL_HINT_USERNAME) ||
            hints.contains(View.AUTOFILL_HINT_EMAIL_ADDRESS)) {
            return true
        }

        val inputType = node.inputType
        if (inputType and InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS != 0 ||
            inputType and InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS != 0) {
            return true
        }

        val hintText = node.hint?.toString()?.lowercase() ?: ""
        val hintId = node.idEntry ?: ""
        val hintIdLower = hintId.lowercase()
        val resourceId = try {
            node.resources?.getResourceEntryName(node.id.toInt())?.lowercase() ?: ""
        } catch (_: Exception) {
            ""
        }

        val usernameKeywords = listOf(
            "اسم المستخدم", "المستخدم", "البريد", "الإيميل",
            "username", "email", "e-mail", "login", "user", "account",
            "phone", "رقم الهاتف", "رقم الجوال", "id"
        )

        return usernameKeywords.any { keyword ->
            hintText.contains(keyword) ||
            hintIdLower.contains(keyword) ||
            resourceId.contains(keyword) ||
            node.className?.lowercase()?.contains(keyword) == true
        }
    }

    fun isPasswordField(node: AssistStructure.ViewNode, hints: List<String>): Boolean {
        if (hints.contains(View.AUTOFILL_HINT_PASSWORD)) {
            return true
        }

        val inputType = node.inputType
        if (inputType and InputType.TYPE_TEXT_VARIATION_PASSWORD != 0 ||
            inputType and InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD != 0 ||
            inputType and InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD != 0) {
            return true
        }

        val hintText = node.hint?.toString()?.lowercase() ?: ""
        val hintId = node.idEntry ?: ""
        val hintIdLower = hintId.lowercase()
        val resourceId = try {
            node.resources?.getResourceEntryName(node.id.toInt())?.lowercase() ?: ""
        } catch (_: Exception) {
            ""
        }

        val passwordKeywords = listOf(
            "كلمة المرور", "كلمة السر", "الرمز السري",
            "password", "passcode", "pwd", "pass", "pin"
        )

        return passwordKeywords.any { keyword ->
            hintText.contains(keyword) ||
            hintIdLower.contains(keyword) ||
            resourceId.contains(keyword) ||
            node.className?.lowercase()?.contains("password") == true
        }
    }

    private fun isOtpField(node: AssistStructure.ViewNode, hints: List<String>): Boolean {
        if (hints.contains(View.AUTOFILL_HINT_SMS_OTP) ||
            hints.contains("otp")) {
            return true
        }

        val hintText = node.hint?.toString()?.lowercase() ?: ""
        val hintId = node.idEntry ?: ""
        val hintIdLower = hintId.lowercase()
        val resourceId = try {
            node.resources?.getResourceEntryName(node.id.toInt())?.lowercase() ?: ""
        } catch (_: Exception) {
            ""
        }

        val otpKeywords = listOf(
            "رمز التحقق", "رمز التأكيد", "otp", "verification",
            "one time", "2fa", "mfa", "token", "كود", "تأكيد"
        )

        return otpKeywords.any { keyword ->
            hintText.contains(keyword) ||
            hintIdLower.contains(keyword) ||
            resourceId.contains(keyword)
        }
    }

    private fun collectAutofillableNodes(structure: AssistStructure): List<AssistStructure.ViewNode> {
        val nodes = mutableListOf<AssistStructure.ViewNode>()

        for (windowIdx in 0 until structure.windowNodeCount) {
            val windowNode = structure.getWindowNodeAt(windowIdx)
            collectNodesRecursive(windowNode.rootViewNode, nodes)
        }

        return nodes
    }

    private fun collectNodesRecursive(
        viewNode: AssistStructure.ViewNode,
        result: MutableList<AssistStructure.ViewNode>
    ) {
        if (viewNode.autofillId != null && viewNode.isEnabled && viewNode.isFocused) {
            result.add(viewNode)
        } else if (viewNode.autofillId != null && viewNode.isEnabled && viewNode.autofillHints != null) {
            result.add(viewNode)
        } else if (viewNode.autofillId != null && viewNode.isEnabled && isAutofillableByInputType(viewNode)) {
            result.add(viewNode)
        } else if (viewNode.autofillId != null && viewNode.isEnabled && isAutofillableByHint(viewNode)) {
            result.add(viewNode)
        }

        for (childIdx in 0 until viewNode.childCount) {
            collectNodesRecursive(viewNode.getChildAt(childIdx), result)
        }
    }

    private fun isAutofillableByInputType(node: AssistStructure.ViewNode): Boolean {
        val inputType = node.inputType
        return inputType and InputType.TYPE_TEXT_VARIATION_PASSWORD != 0 ||
            inputType and InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD != 0 ||
            inputType and InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS != 0 ||
            inputType and InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS != 0
    }

    private fun isAutofillableByHint(node: AssistStructure.ViewNode): Boolean {
        val hintText = node.hint?.toString()?.lowercase() ?: ""
        val keywords = listOf(
            "اسم المستخدم", "المستخدم", "البريد", "كلمة المرور",
            "كلمة السر", "رمز التحقق", "رمز التأكيد",
            "username", "email", "password", "otp", "passcode", "pwd"
        )
        return keywords.any { hintText.contains(it) }
    }

    private fun extractDomain(structure: AssistStructure): String? {
        return try {
            structure.activityComponent?.let { component ->
                component.packageName
            }
        } catch (_: Exception) {
            null
        }
    }
}
