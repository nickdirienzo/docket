const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function encodeTime(timestamp: number, len: number): string {
	let remaining = timestamp;
	let str = "";
	for (let i = len; i > 0; i--) {
		const mod = remaining % ENCODING.length;
		str = ENCODING[mod] + str;
		remaining = (remaining - mod) / ENCODING.length;
	}
	return str;
}

function encodeRandom(len: number): string {
	const bytes = new Uint8Array(len);
	crypto.getRandomValues(bytes);
	let str = "";
	for (let i = 0; i < len; i++) {
		const byte = bytes[i] ?? 0;
		str += ENCODING[byte % ENCODING.length];
	}
	return str;
}

export function ulid(): string {
	return encodeTime(Date.now(), 10) + encodeRandom(16);
}
