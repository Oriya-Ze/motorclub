from app.services.vehicle_brands import canonical_make, make_search_terms


def test_kia_aliases_share_canonical():
    assert canonical_make("Kia") == "קיה"
    assert canonical_make("קיה") == "קיה"
    assert canonical_make("KIA") == "קיה"


def test_audi_spellings_merge():
    assert canonical_make("אאודי") == "אודי"
    assert canonical_make("אודי") == "אודי"
    assert canonical_make("Audi") == "אודי"


def test_search_terms_include_hebrew_and_english():
    terms = {item.lower() for item in make_search_terms("קיה")}
    assert "קיה" in terms
    assert "kia" in terms


def test_mixed_script_japanese_initial():
    assert canonical_make("יapanese") == "Japanese"
