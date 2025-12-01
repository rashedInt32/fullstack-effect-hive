"use client";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Controller, useForm } from "react-hook-form";
import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";

import { authAtom, signupAtom, initializeAuthAtom } from "@/lib/api/atoms/auth";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { SignUpSchema, SignupType } from "@/app/signup/types";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const authState = useAtomValue(authAtom);
  const signup = useAtomSet(signupAtom);
  const initializeAuth = useAtomSet(initializeAuthAtom);

  const router = useRouter();

  const form = useForm<SignupType>({
    resolver: effectTsResolver(SignUpSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (authState.isAuthenticated) {
      router.push("/chat");
    }
  }, [authState.isAuthenticated, router]);

  const handleSubmit = (data: SignupType) => {
    if (data.password !== data.confirmPassword) {
      return form.setError("confirmPassword", {
        message: "Password does not match",
      });
    }

    signup(data);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center 
      bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4"
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign Up</CardTitle>
          <CardDescription>Create a new account to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(handleSubmit)}
          >
            <FieldGroup>
              <Controller
                control={form.control}
                name="username"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="username">Username</FieldLabel>
                    <Input
                      {...field}
                      id="username"
                      aria-invalid={fieldState.invalid}
                      placeholder="username"
                    />

                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="email"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      {...field}
                      id="email"
                      aria-invalid={fieldState.invalid}
                      placeholder="email"
                      type="email"
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      {...field}
                      id="password"
                      aria-invalid={fieldState.invalid}
                      placeholder="*******"
                      type="password"
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="confirmPassword"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="confirmPassword">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      {...field}
                      id="confirmPassword"
                      aria-invalid={fieldState.invalid}
                      type="password"
                      placeholder="********"
                    />
                    {fieldState.error && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              {authState.error && (
                <p className="text-red-600 border border-red-600 px-4 text-sm py-2 rounded-md">
                  {authState.error.message}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={authState.loading}
              >
                {authState.loading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {authState.loading ? "Creating Account..." : "Create Account"}
              </Button>
            </FieldGroup>
          </form>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
