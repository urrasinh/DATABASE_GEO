import pandas as pd
import sqlite3

# Leer el archivo excel
df = pd.read_excel('lugares.xlsx')

# Limpiar los nombres de las columnas para la base de datos (minúsculas y guión bajo)
df.columns = [c.lower().replace(' ', '_') for c in df.columns]

# Conectar a la base de datos (se creará si no existe)
conn = sqlite3.connect('lugares.db')
cursor = conn.cursor()

# Generar la sentencia CREATE TABLE
# Asumiremos la mayoría como TEXT a menos que podamos deducir el tipo.
# Usaremos id como INTEGER PRIMARY KEY AUTOINCREMENT
columns_def = []
for col in df.columns:
    columns_def.append(f"`{col}` TEXT")

create_table_sql = f"""
CREATE TABLE IF NOT EXISTS lugares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    {', '.join(columns_def)}
)
"""

# Eliminar la tabla si existe para recrearla limpia
cursor.execute("DROP TABLE IF EXISTS lugares")
cursor.execute(create_table_sql)

# Insertar los datos
# Como id es autoincremental, iteramos e insertamos
columns_list = ', '.join([f"`{col}`" for col in df.columns])
placeholders = ', '.join(['?'] * len(df.columns))
insert_sql = f"INSERT INTO lugares ({columns_list}) VALUES ({placeholders})"

for row in df.itertuples(index=False):
    cursor.execute(insert_sql, tuple(row))

# Confirmar cambios y cerrar
conn.commit()
conn.close()

print("Base de datos creada exitosamente en 'lugares.db' con 'id' como llave primaria.")
