import pandas as pd
import sqlite3
import os

# Archivo origen
file_name = 'GEOTURISMO-DATA WEB SERVICIOS.xlsx'

# Leer todas las pestañas
xl = pd.ExcelFile(file_name)

for sheet_name in xl.sheet_names:
    df = xl.parse(sheet_name)
    
    # Si la pestaña está vacía, saltarla
    if df.empty:
        print(f"La pestaña '{sheet_name}' está vacía. Saltando...")
        continue
        
    print(f"Procesando pestaña: {sheet_name} ({len(df)} registros)")

    # Limpiar nombres de columnas (minúsculas, sin espacios)
    df.columns = [str(c).lower().replace(' ', '_').strip() for c in df.columns]

    # Nombre de la base de datos
    db_name = f"{sheet_name}.db"
    
    # Conectar a la base de datos de esta pestaña
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Generar SQL para crear tabla usando el nombre de la pestaña como nombre de tabla
    table_name = "servicio"
    columns_def = []
    
    for col in df.columns:
        columns_def.append(f"`{col}` TEXT")

    create_table_sql = f"""
    CREATE TABLE IF NOT EXISTS {table_name} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        {', '.join(columns_def)}
    )
    """

    cursor.execute(f"DROP TABLE IF EXISTS {table_name}")
    cursor.execute(create_table_sql)

    # Insertar los registros
    columns_list = ', '.join([f"`{col}`" for col in df.columns])
    placeholders = ', '.join(['?'] * len(df.columns))
    insert_sql = f"INSERT INTO {table_name} ({columns_list}) VALUES ({placeholders})"

    # Iterar e insertar
    # Convertimos los NaN en None para SQLite
    df = df.where(pd.notnull(df), None)
    
    data_to_insert = [tuple(row) for row in df.itertuples(index=False)]
    cursor.executemany(insert_sql, data_to_insert)

    conn.commit()
    conn.close()
    
    print(f"Base de datos '{db_name}' creada exitosamente.")

print("¡Proceso completado!")
