import { describe, expect, it } from "vitest";
import { getProfileCompleteness } from "@/lib/profile-completeness";

describe("getProfileCompleteness", () => {
  it("marks a professional profile as incomplete when required fields are missing", () => {
    const result = getProfileCompleteness({
      role: "professional",
      avatar_url: "https://example.com/avatar.jpg",
      full_name: "Maria Silva",
      phone: "(11) 99999-9999",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      specialty: "",
      registration: "COREN 123",
      experience: "",
      bio: "Cuidadora com experiencia",
    });

    expect(result.isComplete).toBe(false);
    expect(result.missingFields).toEqual(["Especialidade", "Formações"]);
  });

  it("marks a family profile as complete when all required fields are filled", () => {
    const result = getProfileCompleteness({
      role: "family",
      avatar_url: "https://example.com/avatar.jpg",
      full_name: "Joao Souza",
      phone: "(11) 98888-7777",
      neighborhood: "Jardins",
      city: "Sao Paulo",
      state: "SP",
      patient_name: "Ana Souza",
      patient_age: 74,
      patient_medical_conditions: "Alzheimer",
      bio: "Precisa de cuidador diurno",
      availability: ["Manha"],
    });

    expect(result.isComplete).toBe(true);
    expect(result.missingFields).toEqual([]);
    expect(result.progress).toBe(100);
  });
});
