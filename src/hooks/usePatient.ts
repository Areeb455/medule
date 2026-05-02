/**
 * usePatient — shared hook
 * Returns user_id, patient_name, token, and an apiHeaders helper.
 * Works with Clerk auth.
 */
import { useAuth, useUser } from "@clerk/clerk-react";

const API = import.meta.env.VITE_API_URL || "https://medule-3ix4.onrender.com";

export function usePatient() {
  const { getToken, userId } = useAuth();
  const { user } = useUser();

  const patientName =
    user?.fullName ||
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Patient";

  async function authHeaders(): Promise<HeadersInit> {
    const token = await getToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  function buildFormData(file: File): FormData {
    const fd = new FormData();
    fd.append("image", file);

    if (userId) {
      fd.append("user_id", userId);
      console.log("✅ Sending user_id:", userId);
      console.log("✅ Sending patient_name:", patientName);
    } else {
      console.warn("❌ userId is null — Clerk not loaded or not signed in");
    }

    fd.append("patient_name", patientName);

    // Log all FormData entries for debugging
    for (const [key, value] of fd.entries()) {
      console.log(`FormData → ${key}:`, value);
    }

    return fd;
  }

  return { userId, patientName, authHeaders, buildFormData, API };
}