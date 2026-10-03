interface CreatePeerOptions {
    configuration: RTCConfiguration;
    stream: MediaStream;
    onRemoteStream: (stream: MediaStream) => void;
    onIceCandidate: (candidate: RTCIceCandidate) => void;
}

// Makes a peer connection that sends our stream and reports the other
// person's stream and our ICE candidates.
export const createPeer = ({
    configuration,
    stream,
    onRemoteStream,
    onIceCandidate,
}: CreatePeerOptions) => {
    const peer = new RTCPeerConnection(configuration);

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.ontrack = (event) => {
        onRemoteStream(event.streams[0]);
    };

    peer.onicecandidate = (event) => {
        if (event.candidate) {
            onIceCandidate(event.candidate);
        }
    };

    return peer;
};
