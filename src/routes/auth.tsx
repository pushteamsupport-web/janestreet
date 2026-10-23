import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { ShieldCheck } from "lucide-react";
import { fetchMyRole } from "@/hooks/useRole";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/BrandMark";
import { PasswordInput } from "@/components/PasswordInput";
import { EmailVerification } from "@/components/EmailVerification";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRY_CODES, signInSchema, signUpSchema } from "@/lib/validation";

const APP_ORIGIN = "https://janestreet.vercel.app";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("login"),
});
