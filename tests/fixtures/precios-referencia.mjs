const banda = (category, min_un, max_un, is_reference = false) => ({
    category, min_kg: min_un / 15, max_kg: max_un / 15, min_un, max_un, is_reference,
});
const presentacion = (caliber, prices) => ({
    caliber, country: "URUGUAY", measure_unit: "DOC", prices,
});

export const relevamiento = {
    survey_date: "2026-08-27",
    types: [{
        classification_id: 1,
        classification: "Hortalizas",
        products: [{
            species_id: 1,
            species: "Acelga",
            varieties: [{ variety: "-", presentations: [
                presentacion("G", [banda("E", 350, 400), banda("I", 300, 350)]),
                presentacion("M", [banda("I", 250, 300, true), banda("II", 200, 250)]),
                presentacion("C", [banda("I", 150, 200)]),
            ] }],
        }, {
            species_id: 2,
            species: "Brócoli",
            varieties: [{ variety: "-", presentations: [presentacion("M", [banda("I", 80, 100, true)])] }],
        }, {
            species_id: 60,
            species: "Banana",
            varieties: [{ variety: "Cavendish", presentations: [presentacion("M", [banda("I", 50, 70, true)])] }],
        }, {
            species_id: 3,
            species: "Manzana",
            varieties: Array.from({ length: 82 }, (_, indice) => ({
                variety: `Variedad ${String(indice + 1).padStart(2, "0")}`,
                presentations: [presentacion("M", [banda("I", 50 + indice, 70 + indice, indice % 2 === 0)])],
            })),
        }],
    }],
};
