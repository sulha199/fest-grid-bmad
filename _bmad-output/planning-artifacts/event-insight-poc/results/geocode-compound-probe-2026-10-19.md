# Geocode compound-text probe (generated)

## Summary (labelled texts only: country is the ground truth)

| variant / strategy | texts | right country | right country and confidence >= 0.5 |
|---|--:|--:|--:|
| as stored / no-bias | 21 | 4 | 2 |
| as stored / bias | 21 | 4 | 2 |
| qualifiers removed / no-bias | 21 | 11 | 6 |
| qualifiers removed / bias | 21 | 10 | 5 |
| venue segment / no-bias | 21 | 16 | 13 |
| venue segment / bias | 21 | 16 | 13 |
| venue segment + city / no-bias | 21 | 16 | 13 |
| venue segment + city / bias | 21 | 16 | 13 |

## Every request

| stored text | variant | query sent | strategy | picked | country | confidence | city level | street level | match type |
|---|---|---|---|---|:-:|--:|--:|--:|---|
| Atrium & Plaza Rama, Sleman City Hall | as stored | Atrium & Plaza Rama, Sleman City Hall | no-bias | West Pike Street & West Pike Plaza (Sign-o-rama), West Pike Street, Lawrenceville, GA 30045, United States of America | us | 0.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | as stored | Atrium & Plaza Rama, Sleman City Hall | bias | West Pike Street & West Pike Plaza (Sign-o-rama), West Pike Street, Lawrenceville, GA 30045, United States of America | us | 0.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | qualifiers removed | Plaza Rama, Sleman City Hall | no-bias | Gang Rama, 55285, YO, Indonesia | id | 0.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | qualifiers removed | Plaza Rama, Sleman City Hall | bias | Gang Rama, 55285, YO, Indonesia | id | 0.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | venue segment | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | venue segment | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | venue segment + city | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium & Plaza Rama, Sleman City Hall | venue segment + city | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | as stored | Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | no-bias | PMI Kota Magelang, Jalan Pahlawan, Magelang 56113, JT, Indonesia | id | 0.02 | 0.50 | 0.11 | full_match |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | as stored | Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | bias | PMI Kota Magelang, Jalan Pahlawan, Magelang 56113, JT, Indonesia | id | 0.02 | 0.50 | 0.11 | full_match |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | qualifiers removed | Shinta, Sleman City Hall, Jl. Magelang | no-bias | Jalan Magelang, Samarinda, KM, Indonesia | id | 0.45 |  | 0.90 | match_by_street |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | qualifiers removed | Shinta, Sleman City Hall, Jl. Magelang | bias | Jalan Magelang, Samarinda, KM, Indonesia | id | 0.45 |  | 0.90 | match_by_street |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | venue segment | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | venue segment | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | venue segment + city | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Shinta, Ground Floor, Sleman City Hall, Jl. Magelang | venue segment + city | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | as stored | Customer Service, Ground Floor, Sleman City Hall | no-bias | Customer Service, Pueblo, CO 81005, United States of America | us | 0.55 | 0.44 |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | as stored | Customer Service, Ground Floor, Sleman City Hall | bias | Customer Service, Pueblo, CO 81005, United States of America | us | 0.55 | 0.44 |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | qualifiers removed | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | qualifiers removed | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | venue segment | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | venue segment | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | venue segment + city | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Customer Service, Ground Floor, Sleman City Hall | venue segment + city | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | as stored | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | as stored | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | qualifiers removed | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | qualifiers removed | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | venue segment | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | venue segment | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | venue segment + city | Sleman City Hall | no-bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sleman City Hall | venue segment + city | Sleman City Hall | bias | Sleman City Hall, Jalan Gito Gati, Sleman 55512, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | as stored | Atrium Lower Ground, Galeria Mall | no-bias | Gale Hamkesstraat, 8921 GT Leeuwarden, Netherlands | nl | 0.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | as stored | Atrium Lower Ground, Galeria Mall | bias | Gale Hamkesstraat, 8921 GT Leeuwarden, Netherlands | nl | 0.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | qualifiers removed | Galeria Mall | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | qualifiers removed | Galeria Mall | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | venue segment | Galeria Mall | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | venue segment | Galeria Mall | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Atrium Lower Ground, Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | as stored | Atrium Lower Ground Galeria Mall | no-bias | Gale Hamkesstraat, 8921 GT Leeuwarden, Netherlands | nl | 0.00 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | as stored | Atrium Lower Ground Galeria Mall | bias | Gale Hamkesstraat, 8921 GT Leeuwarden, Netherlands | nl | 0.00 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | qualifiers removed | Galeria Mall | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | qualifiers removed | Galeria Mall | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | venue segment | Galeria Mall | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | venue segment | Galeria Mall | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Atrium Lower Ground Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Watsons, Ground Floor Galeria Mall | as stored | Watsons, Ground Floor Galeria Mall | no-bias | Galería, 78426, SLP, Mexico | mx | 0.70 | 0.06 | 0.04 | full_match |
| Watsons, Ground Floor Galeria Mall | as stored | Watsons, Ground Floor Galeria Mall | bias | Galería, 78426, SLP, Mexico | mx | 0.70 | 0.06 | 0.04 | full_match |
| Watsons, Ground Floor Galeria Mall | qualifiers removed | Watsons, Galeria Mall | no-bias | Gale Hamkesstraat, 8921 GT Leeuwarden, Netherlands | nl | 0.00 |  |  | full_match |
| Watsons, Ground Floor Galeria Mall | qualifiers removed | Watsons, Galeria Mall | bias | (no result) |  |  |  |  |  |
| Watsons, Ground Floor Galeria Mall | venue segment | Galeria Mall | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Watsons, Ground Floor Galeria Mall | venue segment | Galeria Mall | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Watsons, Ground Floor Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Watsons, Ground Floor Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| J.CO, Ground Floor, Galeria Mall | as stored | J.CO, Ground Floor, Galeria Mall | no-bias | Galería, 78426, SLP, Mexico | mx | 0.60 | 0.04 | 0.03 | full_match |
| J.CO, Ground Floor, Galeria Mall | as stored | J.CO, Ground Floor, Galeria Mall | bias | Galería, 78426, SLP, Mexico | mx | 0.60 | 0.04 | 0.03 | full_match |
| J.CO, Ground Floor, Galeria Mall | qualifiers removed | J.CO, Galeria Mall | no-bias | Galeria Drewutnia, Jana Kilińskiego 24A, 98-270 Złoczew, Poland | pl | 0.00 |  |  | full_match |
| J.CO, Ground Floor, Galeria Mall | qualifiers removed | J.CO, Galeria Mall | bias | Galeria Drewutnia, Jana Kilińskiego 24A, 98-270 Złoczew, Poland | pl | 0.00 |  |  | full_match |
| J.CO, Ground Floor, Galeria Mall | venue segment | Galeria Mall | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| J.CO, Ground Floor, Galeria Mall | venue segment | Galeria Mall | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| J.CO, Ground Floor, Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | no-bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| J.CO, Ground Floor, Galeria Mall | venue segment + city | Galeria Mall, Yogyakarta | bias | Galeria Mall, Gang Resonegaran 1, Yogyakarta 55223, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | as stored | Grand Atrium Pakuwon Mall Jogja | no-bias | The Grand Atrium Shopping Mall Faisalabad, West Canal Road, Faisalabad City Tehsil 38700, Pakistan | pk | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | as stored | Grand Atrium Pakuwon Mall Jogja | bias | The Grand Atrium Shopping Mall Faisalabad, West Canal Road, Faisalabad City Tehsil 38700, Pakistan | pk | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | qualifiers removed | Grand Pakuwon Mall Jogja | no-bias | Jalan Grand Pakuwon Asri, Kaliwungu 51351, JT, Indonesia | id | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | qualifiers removed | Grand Pakuwon Mall Jogja | bias | Jalan Grand Pakuwon Asri, Kaliwungu 51351, JT, Indonesia | id | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | venue segment | Grand Pakuwon Mall Jogja | no-bias | Jalan Grand Pakuwon Asri, Kaliwungu 51351, JT, Indonesia | id | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | venue segment | Grand Pakuwon Mall Jogja | bias | Jalan Grand Pakuwon Asri, Kaliwungu 51351, JT, Indonesia | id | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | venue segment + city | Grand Pakuwon Mall Jogja, Yogyakarta | no-bias | Jalan Grand Pakuwon Asri, Kaliwungu 51351, JT, Indonesia | id | 0.00 |  |  | full_match |
| Grand Atrium Pakuwon Mall Jogja | venue segment + city | Grand Pakuwon Mall Jogja, Yogyakarta | bias | Jalan Grand Pakuwon Asri, Kaliwungu 51351, JT, Indonesia | id | 0.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | as stored | TKP JOGJA Lantai 2, Pakuwon Mall Jogja | no-bias | Cl Cementerio-ml (malillos-ml), 2, 24339, Spain | es | 0.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | as stored | TKP JOGJA Lantai 2, Pakuwon Mall Jogja | bias | Cl Cementerio-ml (malillos-ml), 2, 24339, Spain | es | 0.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | qualifiers removed | TKP JOGJA, Pakuwon Mall Jogja | no-bias | Gang Pakuwon, 45193, JR, Indonesia | id | 0.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | qualifiers removed | TKP JOGJA, Pakuwon Mall Jogja | bias | Gang Pakuwon, 45193, JR, Indonesia | id | 0.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | venue segment | Pakuwon Mall Jogja | no-bias | Pakuwon Mall Jogja, Ring Road Utara, Depok 55283, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | venue segment | Pakuwon Mall Jogja | bias | Pakuwon Mall Jogja, Ring Road Utara, Depok 55283, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | venue segment + city | Pakuwon Mall Jogja, Yogyakarta | no-bias | Pakuwon Mall Jogja, Ring Road Utara, Depok 55283, Special Region of Yogyakarta, Indonesia | id | 0.75 |  |  | full_match |
| TKP JOGJA Lantai 2, Pakuwon Mall Jogja | venue segment + city | Pakuwon Mall Jogja, Yogyakarta | bias | Pakuwon Mall Jogja, Ring Road Utara, Depok 55283, Special Region of Yogyakarta, Indonesia | id | 0.75 |  |  | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | as stored | Sky Commons, Lantai 3A, Plaza Ambarrukmo | no-bias | Pz Plaza, 3A, 22710, Spain | es | 0.06 |  | 0.90 | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | as stored | Sky Commons, Lantai 3A, Plaza Ambarrukmo | bias | Pz Plaza, 3A, 22710, Spain | es | 0.06 |  | 0.90 | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | qualifiers removed | Sky Commons, Plaza Ambarrukmo | no-bias | Sky Vista Commons, 9455 Sky Vista Parkway, Reno, NV 89506, United States of America | us | 0.00 |  |  | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | qualifiers removed | Sky Commons, Plaza Ambarrukmo | bias | Sky Vista Commons, 9455 Sky Vista Parkway, Reno, NV 89506, United States of America | us | 0.00 |  |  | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | venue segment | Plaza Ambarrukmo | no-bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | venue segment | Plaza Ambarrukmo | bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | venue segment + city | Plaza Ambarrukmo, Yogyakarta | no-bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Sky Commons, Lantai 3A, Plaza Ambarrukmo | venue segment + city | Plaza Ambarrukmo, Yogyakarta | bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | as stored | Sushi Go – Plaza Ambarrukmo, Lantai 3 | no-bias | Sushi Go, Grand Junction, CO 81505, United States of America | us | 0.06 | 0.11 |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | as stored | Sushi Go – Plaza Ambarrukmo, Lantai 3 | bias | Sushi Go, Grand Junction, CO 81505, United States of America | us | 0.06 | 0.11 |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | qualifiers removed | Sushi Go – Plaza Ambarrukmo | no-bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 0.81 | 0.06 |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | qualifiers removed | Sushi Go – Plaza Ambarrukmo | bias | (no result) |  |  |  |  |  |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | venue segment | Plaza Ambarrukmo | no-bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | venue segment | Plaza Ambarrukmo | bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | venue segment + city | Plaza Ambarrukmo, Yogyakarta | no-bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Sushi Go – Plaza Ambarrukmo, Lantai 3 | venue segment + city | Plaza Ambarrukmo, Yogyakarta | bias | Plaza Ambarrukmo, Jalan Laksda Adisucipto, Depok 55281, Special Region of Yogyakarta, Indonesia | id | 0.67 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | as stored | Plaza Ambarrukmo Mall Jogja | no-bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | as stored | Plaza Ambarrukmo Mall Jogja | bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | qualifiers removed | Plaza Ambarrukmo Mall Jogja | no-bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | qualifiers removed | Plaza Ambarrukmo Mall Jogja | bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | venue segment | Plaza Ambarrukmo Mall Jogja | no-bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | venue segment | Plaza Ambarrukmo Mall Jogja | bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | venue segment + city | Plaza Ambarrukmo Mall Jogja, Yogyakarta | no-bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Plaza Ambarrukmo Mall Jogja | venue segment + city | Plaza Ambarrukmo Mall Jogja, Yogyakarta | bias | Plaza Mall Street, Thulamela, Thohoyandou, 0976, South Africa | za | 0.00 |  |  | full_match |
| Spiral Deck Zona D, GIK UGM | as stored | Spiral Deck Zona D, GIK UGM | no-bias | (no result) |  |  |  |  |  |
| Spiral Deck Zona D, GIK UGM | as stored | Spiral Deck Zona D, GIK UGM | bias | (no result) |  |  |  |  |  |
| Spiral Deck Zona D, GIK UGM | qualifiers removed | Spiral Deck, GIK UGM | no-bias | Spiral Deck, Allentown, PA 18102, United States of America | us | 0.50 |  |  | full_match |
| Spiral Deck Zona D, GIK UGM | qualifiers removed | Spiral Deck, GIK UGM | bias | Spiral Deck, Allentown, PA 18102, United States of America | us | 0.50 |  |  | full_match |
| Spiral Deck Zona D, GIK UGM | venue segment | GIK UGM | no-bias | GIK UGM, Jalan Persatuan, Depok 55222, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Spiral Deck Zona D, GIK UGM | venue segment | GIK UGM | bias | GIK UGM, Jalan Persatuan, Depok 55222, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| Spiral Deck Zona D, GIK UGM | venue segment + city | GIK UGM, Yogyakarta | no-bias | GIK UGM, Jalan Persatuan, Depok 55222, YO, Indonesia | id | 0.67 |  |  | full_match |
| Spiral Deck Zona D, GIK UGM | venue segment + city | GIK UGM, Yogyakarta | bias | GIK UGM, Jalan Persatuan, Depok 55222, YO, Indonesia | id | 0.67 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | as stored | Institute France Indonesie, Lembaga Indonesia Prancis | no-bias | Universiti Kuala Lumpur - Malaysia France Institute, 43600 Bangi, SGR, Malaysia | my | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | as stored | Institute France Indonesie, Lembaga Indonesia Prancis | bias | Universiti Kuala Lumpur - Malaysia France Institute, 43600 Bangi, SGR, Malaysia | my | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | qualifiers removed | Institute France Indonesie, Lembaga Indonesia Prancis | no-bias | Universiti Kuala Lumpur - Malaysia France Institute, 43600 Bangi, SGR, Malaysia | my | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | qualifiers removed | Institute France Indonesie, Lembaga Indonesia Prancis | bias | Universiti Kuala Lumpur - Malaysia France Institute, 43600 Bangi, SGR, Malaysia | my | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | venue segment | Lembaga Indonesia Prancis | no-bias | Eijkman Institute for Molecular Biology, Jalan Pangeran Diponegoro 69, Kenari, Jakarta 10430, JK, Indonesia | id | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | venue segment | Lembaga Indonesia Prancis | bias | Eijkman Institute for Molecular Biology, Jalan Pangeran Diponegoro 69, Kenari, Jakarta 10430, JK, Indonesia | id | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | venue segment + city | Lembaga Indonesia Prancis, Yogyakarta | no-bias | Lembaga Pengembangan Perbankan Indonesia, Bangka, South Jakarta 12720, JK, Indonesia | id | 0.00 |  |  | full_match |
| Institute France Indonesie, Lembaga Indonesia Prancis | venue segment + city | Lembaga Indonesia Prancis, Yogyakarta | bias | Lembaga Pengembangan Perbankan Indonesia, Bangka, South Jakarta 12720, JK, Indonesia | id | 0.00 |  |  | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | as stored | Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | no-bias | Open Space Court, Howard County, MD 20777, United States of America | us | 0.12 | 0.07 | 0.06 | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | as stored | Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | bias | Open Space Court, Howard County, MD 20777, United States of America | us | 0.12 | 0.07 | 0.06 | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | qualifiers removed | Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | no-bias | Open Space Court, Howard County, MD 20777, United States of America | us | 0.12 | 0.07 | 0.06 | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | qualifiers removed | Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | bias | Open Space Court, Howard County, MD 20777, United States of America | us | 0.12 | 0.07 | 0.06 | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | venue segment | Open Space JIExpo dan Gambir Expo | no-bias | Open Space Run, Pasco County, FL 34653, United States of America | us | 0.00 |  |  | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | venue segment | Open Space JIExpo dan Gambir Expo | bias | Open Space Run, Pasco County, FL 34653, United States of America | us | 0.00 |  |  | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | venue segment + city | Open Space JIExpo dan Gambir Expo, Jakarta | no-bias | Open Space Run, Pasco County, FL 34653, United States of America | us | 0.00 |  |  | full_match |
| Open Space JIExpo dan Gambir Expo, Kemayoran - Jakarta | venue segment + city | Open Space JIExpo dan Gambir Expo, Jakarta | bias | Open Space Run, Pasco County, FL 34653, United States of America | us | 0.00 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | as stored | Tennis Indoor Senayan, Jakarta | no-bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.50 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | as stored | Tennis Indoor Senayan, Jakarta | bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.50 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | qualifiers removed | Tennis Indoor Senayan, Jakarta | no-bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.50 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | qualifiers removed | Tennis Indoor Senayan, Jakarta | bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.50 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | venue segment | Tennis Indoor Senayan | no-bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.67 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | venue segment | Tennis Indoor Senayan | bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.67 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | venue segment + city | Tennis Indoor Senayan, Jakarta | no-bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.50 |  |  | full_match |
| Tennis Indoor Senayan, Jakarta | venue segment + city | Tennis Indoor Senayan, Jakarta | bias | Indoor Tennis, Cherry Creek Trail, Denver, CO 80218, United States of America | us | 0.50 |  |  | full_match |
| Kudus City Walk Mall | as stored | Kudus City Walk Mall | no-bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | as stored | Kudus City Walk Mall | bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | qualifiers removed | Kudus City Walk Mall | no-bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | qualifiers removed | Kudus City Walk Mall | bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | venue segment | Kudus City Walk Mall | no-bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | venue segment | Kudus City Walk Mall | bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | venue segment + city | Kudus City Walk Mall | no-bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| Kudus City Walk Mall | venue segment + city | Kudus City Walk Mall | bias | Mall Road To City Walk, Bathinda - 151006, PB, India | in | 0.00 |  |  | full_match |
| LA Plaza Lamongan | as stored | LA Plaza Lamongan | no-bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | as stored | LA Plaza Lamongan | bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | qualifiers removed | LA Plaza Lamongan | no-bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | qualifiers removed | LA Plaza Lamongan | bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | venue segment | LA Plaza Lamongan | no-bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | venue segment | LA Plaza Lamongan | bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | venue segment + city | LA Plaza Lamongan | no-bias | (no result) |  |  |  |  |  |
| LA Plaza Lamongan | venue segment + city | LA Plaza Lamongan | bias | (no result) |  |  |  |  |  |
| Icon Mall Gresik | as stored | Icon Mall Gresik | no-bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | as stored | Icon Mall Gresik | bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | qualifiers removed | Icon Mall Gresik | no-bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | qualifiers removed | Icon Mall Gresik | bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | venue segment | Icon Mall Gresik | no-bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | venue segment | Icon Mall Gresik | bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | venue segment + city | Icon Mall Gresik | no-bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| Icon Mall Gresik | venue segment + city | Icon Mall Gresik | bias | Icon Mall, Kembangan, Gresik, Indonesia | id | 0.00 |  |  | full_match |
| JEC | as stored | JEC | no-bias | JEC, Jalan Janti, Banguntapan 55198, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| JEC | as stored | JEC | bias | JEC, Jalan Janti, Banguntapan 55198, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| JEC | qualifiers removed | JEC | no-bias | JEC, Jalan Janti, Banguntapan 55198, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| JEC | qualifiers removed | JEC | bias | JEC, Jalan Janti, Banguntapan 55198, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| JEC | venue segment | JEC | no-bias | JEC, Jalan Janti, Banguntapan 55198, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| JEC | venue segment | JEC | bias | JEC, Jalan Janti, Banguntapan 55198, Special Region of Yogyakarta, Indonesia | id | 1.00 |  |  | full_match |
| JEC | venue segment + city | JEC, Yogyakarta | no-bias | JEC, Jalan Janti, Banguntapan 55198, YO, Indonesia | id | 0.50 |  |  | full_match |
| JEC | venue segment + city | JEC, Yogyakarta | bias | JEC, Jalan Janti, Banguntapan 55198, YO, Indonesia | id | 0.50 |  |  | full_match |
| Convention Hall Lt.2 | as stored | Convention Hall Lt.2 | no-bias | (no result) |  |  |  |  |  |
| Convention Hall Lt.2 | as stored | Convention Hall Lt.2 | bias | Convention Hall, Jalan Padang - Painan, Padang 25521, SB, Indonesia | id | 0.81 |  |  | full_match |
| Convention Hall Lt.2 | qualifiers removed | Convention Hall | no-bias | Convention Hall, Jalan Kampus Unand, Padang 25163, West Sumatra, Indonesia | id | 1.00 |  |  | full_match |
| Convention Hall Lt.2 | qualifiers removed | Convention Hall | bias | Convention Hall, Jalan Kampus Unand, Padang 25163, West Sumatra, Indonesia | id | 1.00 |  |  | full_match |
| Convention Hall Lt.2 | venue segment | Convention Hall | no-bias | Convention Hall, Jalan Kampus Unand, Padang 25163, West Sumatra, Indonesia | id | 1.00 |  |  | full_match |
| Convention Hall Lt.2 | venue segment | Convention Hall | bias | Convention Hall, Jalan Kampus Unand, Padang 25163, West Sumatra, Indonesia | id | 1.00 |  |  | full_match |
| Convention Hall Lt.2 | venue segment + city | Convention Hall | no-bias | Convention Hall, Jalan Kampus Unand, Padang 25163, West Sumatra, Indonesia | id | 1.00 |  |  | full_match |
| Convention Hall Lt.2 | venue segment + city | Convention Hall | bias | Convention Hall, Jalan Kampus Unand, Padang 25163, West Sumatra, Indonesia | id | 1.00 |  |  | full_match |
| Court 2 | as stored | Court 2 | no-bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | as stored | Court 2 | bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | qualifiers removed | Court 2 | no-bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | qualifiers removed | Court 2 | bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | venue segment | Court 2 | no-bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | venue segment | Court 2 | bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | venue segment + city | Court 2 | no-bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Court 2 | venue segment + city | Court 2 | bias | Court 2, St. Catharines, ON, Canada | ca | 1.00 |  |  | full_match |
| Online | as stored | Online | no-bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | as stored | Online | bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | qualifiers removed | Online | no-bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | qualifiers removed | Online | bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | venue segment | Online | no-bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | venue segment | Online | bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | venue segment + city | Online | no-bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
| Online | venue segment + city | Online | bias | Online, Croix d'Argent, Montpellier, Hérault, France | fr | 1.00 |  |  | full_match |
