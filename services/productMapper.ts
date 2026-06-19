export const brandMap: Record<string, string> = {
  "P": "PEUGEOT",
  "CE": "CENTAURO",
  "C": "CENTAURO",
  "L": "LUBRICANTES",
  "A": "ACCESORIOS",
  "V": "VOLSKWAGEN",
  "F": "FERRETERIA",
  "210420163": "ACCESORIOS",
  "D": "DONG FENG",
  "B": "BATERIAS",
  "LU": "LUBRICANTES",
  "CI": "CITROEN",
  "BC025": "LUBRICANTES",
  "R": "RENAULT",
  "I": "ILUMINACION",
  "T": "TECNOLOGIA",
  "BC026": "LUBRICANTES",
  "15W40": "LUBRICANTES",
  "20W50": "LUBRICANTES",
  "80W90": "LUBRICANTES",
  "SERVI2": "DELIVERY",
  "M": "MULTIMARCA",
  "5W40": "LUBRICANTES",
  "G": "GRIFERIA",
  "NULL": "CON ERROR",
  "1149": "CORREGIR",
  "721069": "CORREGIR",
  "SERVI": "DELIVERY",
  "DIII": "LUBRICANTES",
  "-EM-28B-EDC": "VOLSKWAGEN",
  "L7840": "LUBRICANTES",
  "10W30": "LUBRICANTES",
  "VPEM": "VOLSKWAGEN",
  "DVFPET500ML": "BEBIDAS",
  "FANTAN": "BEBIDAS",
  "FANTAT": "BEBIDAS",
  "COCA": "BEBIDAS",
  "AGUAN": "BEBIDAS",
  "AGUAG": "BEBIDAS",
  "SN": "SNACK",
  "BE": "BEBIDAS"
};

export const categoryMap: Record<string, string> = {
  "ACCESORIOS": "A",
  "INYECCION": "INY",
  "CADENAS": "CD",
  "CAJA AUTOMATICA": "CA",
  "CAJA SINCRONICA": "CS",
  "CARROCERIA": "CR",
  "CORREAS": "CO",
  "EMPACADURAS": "EM",
  "ESTOPERAS": "ES",
  "FILTROS": "F",
  "MANGUERAS": "MG",
  "PARTES ELECTRICAS": "PE",
  "PARTES ENCENDIDO": "PEN",
  "PARTES INTERNAS DE MOTOR": "PIM",
  "PARTES EXTERNAS DE MOTOR": "PEM",
  "REFRIGERACION": "R",
  "SISTEMA DE FRENOS": "SF",
  "SOPORTES": "SO",
  "SUSPENSION DELANTERA": "SUD",
  "SUSPENSION TRASERA": "SUT",
  "RODAMIENTOS": "RO",
  "LUCES": "LU",
  "DIRECCION": "DI",
  "LUBRICANTES": "LU",
  // Reverse mapping for parsing:
  "A": "ACCESORIOS",
  "INY": "INYECCION",
  "CD": "CADENAS",
  "CA": "CAJA AUTOMATICA",
  "CS": "CAJA SINCRONICA",
  "CR": "CARROCERIA",
  "CO": "CORREAS",
  "EM": "EMPACADURAS",
  "ES": "ESTOPERAS",
  "F": "FILTROS",
  "MG": "MANGUERAS",
  "PE": "PARTES ELECTRICAS",
  "PEN": "PARTES ENCENDIDO",
  "PIM": "PARTES INTERNAS DE MOTOR",
  "PEM": "PARTES EXTERNAS DE MOTOR",
  "R": "REFRIGERACION",
  "SF": "SISTEMA DE FRENOS",
  "SO": "SOPORTES",
  "SUD": "SUSPENSION DELANTERA",
  "SUT": "SUSPENSION TRASERA",
  "RO": "RODAMIENTOS",
  "LU": "LUCES",
  "DI": "DIRECCION"
};

export interface ParsedProduct {
  code: string;
  brand: string;
  category: string;
}

export function parseProductCode(code: string): ParsedProduct {
  if (!code) {
    return { code: "", brand: "VERIFICAR", category: "VERIFICAR" };
  }

  const cleanCode = code.trim().toUpperCase();

  // Explicit full code override (like -EM-28B-EDC)
  if (brandMap[cleanCode]) {
    return {
      code: cleanCode,
      brand: brandMap[cleanCode],
      // If it's a direct override that is literally just a drink/snack, maybe category is NA
      category: "VERIFICAR"
    };
  }

  const parts = cleanCode.split('-');
  
  // If no hyphen, the whole code is the prefix
  if (parts.length === 1) {
    return {
      code: cleanCode,
      brand: brandMap[parts[0]] || "VERIFICAR",
      category: "VERIFICAR"
    };
  }

  // Handle leading hyphen e.g. -EM-28B-EDC (parts would be ["", "EM", "28B", "EDC"])
  let prefix = parts[0];
  let catCode = parts[1];

  if (prefix === "" && parts.length > 1) {
    // maybe they meant the first actual part is the brand?
    // or maybe the whole thing is unmapped
    prefix = parts[1];
    catCode = parts.length > 2 ? parts[2] : "";
  }

  const brand = brandMap[prefix] || "VERIFICAR";
  const category = categoryMap[catCode] || "VERIFICAR";

  return { code: cleanCode, brand, category };
}
