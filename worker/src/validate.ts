import { VALID_ESTIMATES } from "./types";

export function asStringOrNull(val: unknown): string | null {
	if (val == null || val === "") return null;
	if (typeof val === "string") return val;
	return String(val);
}

export function validatedEnum<T extends string>(
	val: unknown,
	allowed: readonly T[],
	defaultVal: T,
): T {
	if (val == null) return defaultVal;
	if (typeof val !== "string" || !allowed.includes(val as T)) {
		throw new Error(`Invalid value "${val}". Allowed: ${allowed.join(", ")}`);
	}
	return val as T;
}

export function validatedEnumOrNull<T extends string>(
	val: unknown,
	allowed: readonly T[],
): T | null {
	if (val == null) return null;
	return validatedEnum(val, allowed, allowed[0] as T);
}

export function validatedEstimate(val: unknown): number | null {
	if (val == null) return null;
	const num = Number(val);
	if (!VALID_ESTIMATES.includes(num as (typeof VALID_ESTIMATES)[number])) {
		throw new Error(`Invalid estimate "${val}". Allowed: ${VALID_ESTIMATES.join(", ")}`);
	}
	return num;
}
