using System;
using System.Security.Principal;

namespace Ameen.Windows.Services;

public class WindowsAccountIsolationService
{
    public string GetCurrentUserSid()
    {
        return WindowsIdentity.GetCurrent().User?.Value ?? "unknown";
    }

    public string GetCurrentUserName()
    {
        return WindowsIdentity.GetCurrent().Name;
    }

    public bool IsAddingMemberSafe(string storedUserSid)
    {
        var currentSid = GetCurrentUserSid();
        return !string.Equals(currentSid, storedUserSid, StringComparison.Ordinal);
    }

    public string GetIsolationWarningMessage(string memberName)
    {
        return $"تحذير أمني: تحاول إضافة {memberName} على نفس حساب ويندوز. للحصول على عزل حقيقي، يُوصى بإنشاء حساب ويندوز منفصل لكل فرد من أفراد العائلة. لن يُسمح بربط بصمة جديدة للعضو على نفس الحساب.";
    }

    public static string GetCurrentWindowsUserName()
    {
        return WindowsIdentity.GetCurrent().Name;
    }

    public static bool IsSameAccount(string existingAdminUser)
    {
        var current = GetCurrentWindowsUserName();
        return string.Equals(current, existingAdminUser, StringComparison.OrdinalIgnoreCase);
    }

    public static string GetIsolationWarningMessage()
    {
        return "⚠️ تحذير أمني: هذا العضو سيشارك نفس حساب ويندوز مع المسؤول. " +
               "للاستفادة من العزل العائلي الحقيقي، يُوصى بإنشاء حساب ويندوز منفصل لكل فرد.\n\n" +
               "هل تريد المتابعة على أي حال؟";
    }

    public static string GetIsolationWarningTitle() => "تحذير عزل الحسابات";
}
