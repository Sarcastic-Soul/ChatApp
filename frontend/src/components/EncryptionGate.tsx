import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Loader, PasswordInput, Stack } from "@mantine/core";
import { WarningIcon } from "@phosphor-icons/react";
import AuthLayout from "./AuthLayout";
import { useAuthContext } from "../context/useAuthContext";
import useLogout from "../hooks/useLogout";
import {
    AlreadySetUpError,
    fetchMyKey,
    forgetIdentity,
    loadIdentity,
    setUpEncryption,
    unlockEncryption,
    type MyKey,
} from "../utils/e2ee/identity";
import { WrongPassphraseError } from "../utils/e2ee/crypto";
import { forgetChatKeys } from "../utils/e2ee/chats";
import { DEMO_ACCOUNT } from "../utils/demo";
import { errorMessage } from "../utils/errorMessage";

// Stands in front of the chat until this browser holds the user's private
// key: made fresh on first use, or restored from the passphrase backup.

const MIN_LENGTH = 8;

type Mode =
    | { name: "checking" }
    | { name: "ready" }
    | { name: "create" }
    | { name: "unlock"; myKey: MyKey }
    | { name: "reset" }
    | { name: "failed"; error: string };

const EncryptionGate = ({ children }: { children: ReactNode }) => {
    const { authUser } = useAuthContext();
    const { loading: loggingOut, logout } = useLogout();
    const [mode, setMode] = useState<Mode>({ name: "checking" });
    const [passphrase, setPassphrase] = useState("");
    const [confirm, setConfirm] = useState("");
    // Shown under the field it belongs to
    const [error, setError] = useState<{ on: "passphrase" | "confirm"; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const userId = authUser?._id ?? "";
    const isDemo = authUser?.username === DEMO_ACCOUNT.username;

    // The demo account's passphrase is public, like its password, so every
    // visitor sets up and unlocks the same key
    const go = useCallback(
        (next: Mode) => {
            const fill = isDemo ? DEMO_ACCOUNT.passphrase : "";
            setMode(next);
            setPassphrase(fill);
            setConfirm(fill);
            setError(null);
        },
        [isDemo],
    );

    const check = useCallback(async () => {
        const local = await loadIdentity(userId).catch(() => null);
        let myKey: MyKey;
        try {
            myKey = await fetchMyKey();
        } catch (fetchError) {
            // Offline with a key already here: the cached chats still work
            go(local ? { name: "ready" } : { name: "failed", error: errorMessage(fetchError) });
            return;
        }
        if (!myKey.publicKey) {
            if (local) await forgetIdentity().catch(() => {});
            go({ name: "create" });
        } else if (local && local.publicKey === myKey.publicKey && local.keyVersion === myKey.keyVersion) {
            go({ name: "ready" });
        } else {
            // A key from before a reset on another browser
            if (local) await forgetIdentity().catch(() => {});
            go({ name: "unlock", myKey });
        }
    }, [userId, go]);

    useEffect(() => {
        // Loads the key state; every state change comes after a request
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void check();
    }, [check]);

    const recheck = () => {
        go({ name: "checking" });
        void check();
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (mode.name !== "create" && mode.name !== "reset" && mode.name !== "unlock") return;
        if (mode.name !== "unlock") {
            if (passphrase.length < MIN_LENGTH) return setError({ on: "passphrase", text: `Use at least ${MIN_LENGTH} characters.` });
            if (passphrase !== confirm) return setError({ on: "confirm", text: "The passphrases don't match." });
        }
        setBusy(true);
        setError(null);
        try {
            if (mode.name === "unlock") await unlockEncryption(userId, mode.myKey, passphrase);
            else await setUpEncryption(userId, passphrase, { reset: mode.name === "reset" });
            forgetChatKeys();
            go({ name: "ready" });
        } catch (submitError) {
            if (submitError instanceof AlreadySetUpError) {
                // Set up on another browser in the meantime
                recheck();
            } else {
                setError({
                    on: "passphrase",
                    text: submitError instanceof WrongPassphraseError ? submitError.message : errorMessage(submitError),
                });
            }
        } finally {
            setBusy(false);
        }
    };

    if (mode.name === "ready") return <>{children}</>;

    const logOutButton = (
        <Button variant="subtle" color="gray" fullWidth loading={loggingOut} disabled={busy} onClick={logout}>
            Log out
        </Button>
    );

    if (mode.name === "checking") {
        return (
            <div className="gate-loading" role="status">
                <Loader size="sm" />
                <span>Checking your encryption key</span>
            </div>
        );
    }

    if (mode.name === "failed") {
        return (
            <AuthLayout title="Can't reach the server" subtitle={mode.error} aside={ASIDE}>
                <Stack gap="sm">
                    <Button fullWidth size="md" onClick={recheck}>
                        Try again
                    </Button>
                    {logOutButton}
                </Stack>
            </AuthLayout>
        );
    }

    const copy = {
        create: {
            title: "Choose a passphrase",
            subtitle: "Your messages are encrypted on your device. The passphrase lets you read them when you log in somewhere new. We never see it, and we can't recover it.",
            submit: "Turn on encryption",
        },
        reset: {
            title: "Start over with a new key",
            subtitle: "Pick a new passphrase. Your contacts will switch to your new key.",
            submit: "Make a new key",
        },
        unlock: {
            title: "Enter your passphrase",
            subtitle: "This browser needs your key to read and send encrypted messages.",
            submit: "Unlock",
        },
    }[mode.name];

    return (
        <AuthLayout title={copy.title} subtitle={copy.subtitle} aside={ASIDE}>
            <form onSubmit={handleSubmit} noValidate>
                <Stack gap="md">
                    {mode.name === "reset" && (
                        <Alert color="orange" variant="light" icon={<WarningIcon size={18} />}>
                            Encrypted messages from before the reset can't be read with the new key, on any device.
                        </Alert>
                    )}
                    {isDemo && (
                        <p className="gate-hint">
                            This is the shared demo account, so its passphrase is filled in for you.
                        </p>
                    )}
                    <PasswordInput
                        label="Passphrase"
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.currentTarget.value)}
                        autoComplete={mode.name === "unlock" ? "current-password" : "new-password"}
                        description={mode.name === "unlock" ? undefined : `At least ${MIN_LENGTH} characters. A few random words work well.`}
                        error={error?.on === "passphrase" ? error.text : undefined}
                        size="md"
                        data-autofocus
                        autoFocus
                        required
                    />
                    {mode.name !== "unlock" && (
                        <PasswordInput
                            label="Confirm passphrase"
                            value={confirm}
                            onChange={(e) => setConfirm(e.currentTarget.value)}
                            autoComplete="new-password"
                            error={error?.on === "confirm" ? error.text : undefined}
                            size="md"
                            required
                        />
                    )}
                    <Button type="submit" loading={busy} disabled={loggingOut} fullWidth size="md" mt={4}>
                        {copy.submit}
                    </Button>
                    {logOutButton}
                </Stack>
            </form>
            {mode.name === "unlock" && (
                <p className="auth-switch">
                    Forgot your passphrase?{" "}
                    <button type="button" className="gate-link" onClick={() => go({ name: "reset" })}>
                        Make a new key
                    </button>
                </p>
            )}
            {mode.name === "reset" && (
                <p className="auth-switch">
                    Remembered it?{" "}
                    <button type="button" className="gate-link" onClick={recheck}>
                        Go back
                    </button>
                </p>
            )}
        </AuthLayout>
    );
};

const ASIDE = "Messages are locked on your device. Only the people in the chat hold the key.";

export default EncryptionGate;
