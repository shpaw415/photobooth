startCamera();
async function startCamera() {
	const videoElement = document.getElementById("webcam") as HTMLVideoElement;

	// Define media requirements (constraints)
	const constraints: MediaStreamConstraints = {
		video: {
			width: { ideal: 1280 },
			height: { ideal: 720 },
			facingMode: "user", // "user" for front camera, "environment" for rear camera
		},
		audio: false, // Set to true if you also need the microphone
	};

	try {
		// Request browser permission and fetch the media stream
		const stream = await navigator.mediaDevices.getUserMedia(constraints);

		// Assign the stream to the HTML video element
		videoElement.srcObject = stream;
	} catch (error) {
		console.error("Error accessing the camera: ", error);
		alert("Could not access camera. Please check permissions.");
	}
}
