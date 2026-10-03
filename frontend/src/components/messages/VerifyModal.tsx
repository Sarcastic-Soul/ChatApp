import { useEffect, useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text, UnstyledButton } from "@mantine/core";
import { ArrowLeftIcon, CaretRightIcon, SealCheckIcon, WarningIcon } from "@phosphor-icons/react";
import { useAuthContext } from "../../context/useAuthContext";
import { rememberPeer, safetyNumber, type KeyHolder, type PeerTrust } from "../../utils/e2ee/trust";

interface VerifyModalProps {
    opened: boolean;
    onClose: () => void;
    me: KeyHolder | null;
    peers: PeerTrust[];
    nameOf: (userId: string) => string;
    // Called after a key was marked verified, unverified or accepted
    onChange: () => void;
}

// The safety number of the user and one contact, with the verified switch
const PeerNumber = ({ me, peer, name, onChange }: { me: KeyHolder; peer: PeerTrust; name: string; onChange: () => void }) => {
    const { authUser } = useAuthContext();
    const [number, setNumber] = useState<string[] | null>(null);

    useEffect(() => {
        let stale = false;
        safetyNumber(me, peer)
            .then((groups) => !stale && setNumber(groups))
            .catch(() => {});
        return () => {
            stale = true;
        };
    }, [me, peer]);

    const mark = async (verified: boolean) => {
        if (!authUser) return;
        await rememberPeer(authUser._id, peer, verified);
        onChange();
    };

    return (
        <Stack gap="md">
            {peer.changed && (
                <Alert color="yellow" icon={<WarningIcon size={18} />} title={`${name}'s key changed`}>
                    This happens when someone resets their encryption. It could also mean someone is
                    pretending to be them. Compare the number below before you share anything private.
                </Alert>
            )}

            <Text size="sm" c="dimmed">
                Ask {name} to open this screen too, in person or on a call. If both screens show the
                same number, your messages go only to each other.
            </Text>

            <div className="safety-number tabular" aria-label="Safety number">
                {(number ?? Array.from({ length: 12 }, () => "·····")).map((group, index) => (
                    <span key={index}>{group}</span>
                ))}
            </div>

            {peer.verified ? (
                <Group justify="space-between">
                    <Group gap={6} c="var(--accent-text)">
                        <SealCheckIcon size={18} weight="fill" />
                        <Text size="sm" fw={600}>
                            Verified
                        </Text>
                    </Group>
                    <Button variant="subtle" color="gray" size="xs" onClick={() => mark(false)}>
                        Remove
                    </Button>
                </Group>
            ) : (
                <Group justify="flex-end">
                    {peer.changed && (
                        <Button variant="default" onClick={() => mark(false)}>
                            Accept without checking
                        </Button>
                    )}
                    <Button onClick={() => mark(true)} disabled={!number}>
                        The numbers match
                    </Button>
                </Group>
            )}
        </Stack>
    );
};

// Lets the user compare safety numbers with the people in a chat. A group
// lists its members first; a one-on-one chat goes straight to the number.
const VerifyModal = ({ opened, onClose, me, peers, nameOf, onChange }: VerifyModalProps) => {
    const [pickedId, setPickedId] = useState<string | null>(null);
    const picked = peers.length === 1 ? peers[0] : peers.find((peer) => peer._id === pickedId);

    const close = () => {
        setPickedId(null);
        onClose();
    };

    return (
        <Modal
            opened={opened}
            onClose={close}
            title={picked ? `Verify ${nameOf(picked._id)}` : "Verify encryption"}
            centered
        >
            {!me ? (
                <Text size="sm" c="dimmed">
                    Unlock encryption in this browser to compare safety numbers.
                </Text>
            ) : picked ? (
                <Stack gap="sm">
                    {peers.length > 1 && (
                        <Button
                            variant="subtle"
                            color="gray"
                            size="xs"
                            leftSection={<ArrowLeftIcon size={14} />}
                            onClick={() => setPickedId(null)}
                            style={{ alignSelf: "flex-start" }}
                        >
                            All members
                        </Button>
                    )}
                    <PeerNumber me={me} peer={picked} name={nameOf(picked._id)} onChange={onChange} />
                </Stack>
            ) : (
                <Stack gap={2}>
                    <Text size="sm" c="dimmed" mb="xs">
                        Pick a member to compare safety numbers with.
                    </Text>
                    {peers.map((peer) => (
                        <UnstyledButton key={peer._id} className="row-button" onClick={() => setPickedId(peer._id)}>
                            <Text size="sm" style={{ flex: 1 }} truncate>
                                {nameOf(peer._id)}
                            </Text>
                            <Text size="xs" c={peer.changed ? "yellow.8" : peer.verified ? "var(--accent-text)" : "dimmed"}>
                                {peer.changed ? "Key changed" : peer.verified ? "Verified" : "Not verified"}
                            </Text>
                            <CaretRightIcon size={14} />
                        </UnstyledButton>
                    ))}
                </Stack>
            )}
        </Modal>
    );
};

export default VerifyModal;
