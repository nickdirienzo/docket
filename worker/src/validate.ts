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

export function buildWhere(
	filters: Record<string, unknown>,
	keys: string[],
): { where: string; params: unknown[] } {
	const conditions: string[] = [];
	const params: unknown[] = [];
	for (const key of keys) {
		if (filters[key]) {
			conditions.push(`${key} = ?`);
			params.push(filters[key]);
		}
	}
	return { where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "", params };
}
