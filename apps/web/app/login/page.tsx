"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { effectTsResolver } from "@hookform/resolvers/effect-ts";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Schema } from "effect";
import { useAtomValue, useAtomSet } from "@effect-atom/atom-react";
import { authAtom, loginAtom, initializeAuthAtom } from "@/lib/api/atoms/auth";
import { Loader2 } from "lucide-react";

const LoginSchema = Schema.Struct({
  username: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "Username is required" }),
  ),
  password: Schema.String.pipe(
    Schema.nonEmptyString({ message: () => "Password is required" }),
  ),
});

type LoginType = Schema.Schema.Type<typeof LoginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const authState = useAtomValue(authAtom);
  const setLogin = useAtomSet(loginAtom);
  const initializeAuth = useAtomSet(initializeAuthAtom);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  const form = useForm<LoginType>({
    resolver: effectTsResolver(LoginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleSubmit = (data: LoginType) => {
    setLogin(data);
  };

  if (authState.isAuthenticated) {
    router.push("/chat");
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="" onSubmit={form.handleSubmit(handleSubmit)}>
            <FieldGroup>
              <Controller
                control={form.control}
                name="username"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel htmlFor="email">Username</FieldLabel>
                    <Input
                      {...field}
                      id="email"
                      aria-invalid={fieldState.invalid}
                      placeholder="you@example.com"
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
                      type="password"
                      aria-invalid={fieldState.invalid}
                      placeholder="you@example.com"
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
                {authState.loading ? "Signing in..." : "Sign In"}
              </Button>
            </FieldGroup>
          </form>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
