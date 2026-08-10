export const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, ".")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "..")
    .replace(/\.(\d{3})(\d)/, "./")
    .replace(/(\d{4})(\d)/, "-");
};

export const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "() ")
      .replace(/(\d{4})(\d)/, "-");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "() ")
    .replace(/(\d{5})(\d)/, "-");
};

export const formatCNES = (value: string) => {
  return value.replace(/\D/g, "").slice(0, 7);
};
