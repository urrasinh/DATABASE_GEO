import pandas as pd

df = pd.read_excel('lugares.xlsx')
print("Columns:", df.columns.tolist())
print(df.head())
