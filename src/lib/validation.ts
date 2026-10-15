import { z } from "zod";

export const COUNTRY_CODES = [
  { code: "+1", label: "United States / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+234", label: "Nigeria (+234)" },
  { code: "+27", label: "South Africa (+27)" },
  { code: "+233", label: "Ghana (+233)" },
  { code: "+254", label: "Kenya (+254)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+49", label: "Germany (+49)" },
  { code: "+33", label: "France (+33)" },
  { code: "+34", label: "Spain (+34)" },
  { code: "+39", label: "Italy (+39)" },
  { code: "+31", label: "Netherlands (+31)" },
  { code: "+41", label: "Switzerland (+41)" },
  { code: "+971", label: "United Arab Emirates (+971)" },
  { code: "+91", label: "India (+91)" },
  { code: "+86", label: "China (+86)" },
  { code: "+81", label: "Japan (+81)" },
  { code: "+55", label: "Brazil (+55)" },
  { code: "+52", label: "Mexico (+52)" },
] as const;

const emailField = z
  .string()
  .trim()
  .min(1, { message: "Email address is required" })
  .max(255, { message: "Email address is too long" })
  .email({ message: "Enter a valid email address (e.g. name@example.com)" })
  .refine((value) => /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(value), {
    message: "Enter a valid email address (e.g. name@example.com)",
  });

const passwordField = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be less than 72 characters" })
  .regex(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: "Include an uppercase letter, a lowercase letter and a number",
  });

export const signUpSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: "Enter your full name" })
      .max(100, { message: "Full name is too long" }),
    countryCode: z
      .string()
      .regex(/^\+\d{1,4}$/, { message: "Select your country code" }),
    phone: z
      .string()
      .trim()
      .regex(/^\d{6,14}$/, {
        message: "Enter a valid phone number (digits only, no leading zero)",
      }),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, { message: "Password is required" }),
});

export const emailOnlySchema = z.object({ email: emailField });

export const newPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const caseSchema = z.object({
  title: z.string().trim().min(3, { message: "Give your case a short title" }).max(120),
  amountLost: z.coerce.number().min(0, { message: "Enter the amount lost" }).max(1_000_000_000),
  assetType: z.string().min(1, { message: "Select an asset type" }),


  description: z
    .string()
    .trim()
    .min(20, { message: "Please describe what happened (at least 20 characters)" })
    .max(2000),
});

export type SignUpValues = z.infer<typeof signUpSchema>;
export type CaseValues = z.infer<typeof caseSchema>;
